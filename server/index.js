import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { db } from './db.js';
import { storage } from './storage.js';
import { sendOrderToGoogleSheets, updateOrderStatusInGoogleSheets } from './sheets.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Main Admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'IconicAdmin2023';
const DEFAULT_SHIPPING_FEE = parseFloat(process.env.DEFAULT_SHIPPING_FEE || '100');
const STORE_NAME = process.env.STORE_NAME || 'Order Now Store';
const PAYMENT_INSTRUCTIONS = process.env.PAYMENT_INSTRUCTIONS || 'GCash: 0995 815 6660\nName: JOSH RIAN MARCO ORTUA';
const PENDING_ORDER_EXPIRY_HOURS = parseFloat(process.env.PENDING_ORDER_EXPIRY_HOURS || '48');

// J&T Express charges a flat fee by region, collected upfront as part of the
// order total. Lalamove has no entry here — its shipping fee is paid by the
// customer directly to the rider on delivery, never through the system.
const SHIPPING_FEES = { Luzon: 75, Visayas: 90, Mindanao: 120 };

// Multer memory storage for direct streaming to cloud storage or local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Simple admin auth middleware
const requireAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = req.headers['x-admin-token'] || req.query.admin_token || bearerToken;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Admin credentials required' });
  }
  const isValid = await db.isValidAdminToken(token);
  if (!isValid) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin credentials' });
  }
  next();
};

// ==========================================
// PUBLIC / CUSTOMER ROUTES
// ==========================================

// Get store info and configs
app.get('/api/store-info', (req, res) => {
  res.json({
    storeName: STORE_NAME,
    shippingFee: DEFAULT_SHIPPING_FEE,
    paymentInstructions: PAYMENT_INSTRUCTIONS
  });
});

// Get all products (only products with real uploaded image_url)
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.getProducts();
    // Strictly filter out any items with missing image url
    const validProducts = products.filter(p => p.image_url && p.image_url.trim().length > 0);
    res.json(validProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// Public: look up a single card number's status (used by the card-number selector's
// search/prev/next controls). Never exposes order ids to the customer.
app.get('/api/products/:id/cards/:number', async (req, res) => {
  try {
    const { id } = req.params;
    const cardNumber = parseInt(req.params.number, 10);
    if (isNaN(cardNumber)) {
      return res.status(400).json({ error: 'Invalid card number' });
    }

    const product = await db.getProductById(id);
    if (!product || !product.card_numbering_enabled) {
      return res.status(404).json({ error: 'This product does not use card numbering' });
    }
    if (cardNumber < product.card_number_start || cardNumber > product.card_number_end) {
      return res.status(404).json({ error: 'Card number out of range' });
    }

    const card = await db.getCardByNumber(id, cardNumber);
    if (!card) {
      return res.status(404).json({ error: 'Card number not found' });
    }

    res.json({
      card_number: card.card_number,
      status: card.status,
      price: db.resolveCardPrice(product, card),
      range_start: product.card_number_start,
      range_end: product.card_number_end
    });
  } catch (error) {
    console.error('Error fetching card status:', error);
    res.status(500).json({ error: 'Failed to load card status' });
  }
});

// Public: track a single order's status by its own ID — no admin login needed.
// This is the unique link every customer gets after checkout to self-check
// their order instead of having to ask the seller.
app.get('/api/orders/:id/track', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await db.getOrderById(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found. Please check the link and try again.' });
    }
    res.json({
      order: {
        id: order.id,
        status: order.status,
        payment_status: order.payment_status || null,
        rejection_reason: order.rejection_reason || null,
        customer_name: order.customer_name,
        courier: order.courier,
        payment_method: order.payment_method,
        subtotal: order.subtotal,
        shipping_fee: order.shipping_fee,
        total: order.total,
        items: order.items,
        created_at: order.created_at,
        paid_at: order.paid_at || null
      }
    });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ error: 'Failed to load order status' });
  }
});

// Submit customer order with atomic stock validation & receipt upload
app.post('/api/orders', upload.single('receipt'), async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_address,
      courier,
      shipping_region,
      payment_method,
      items_json
    } = req.body;

    // Validate fields
    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ error: 'Full Name is required' });
    }
    if (!customer_phone || !customer_phone.trim()) {
      return res.status(400).json({ error: 'Phone Number is required' });
    }
    if (!customer_address || !customer_address.trim()) {
      return res.status(400).json({ error: 'Complete Delivery Address is required' });
    }
    if (!courier || !courier.trim()) {
      return res.status(400).json({ error: 'Courier is required' });
    }
    if (!payment_method || !payment_method.trim()) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    // Shipping fee is resolved authoritatively here, never trusted from the
    // client. J&T Express charges a flat fee by region, collected upfront as
    // part of the order total; Lalamove has no fee added here since that's
    // paid by the customer directly to the rider on delivery.
    let finalCourier = courier;
    let shipping_fee = 0;
    if (courier === 'J&T Express') {
      if (!shipping_region || !SHIPPING_FEES[shipping_region]) {
        return res.status(400).json({ error: 'Please select a shipping region (Luzon, Visayas, or Mindanao) for J&T Express.' });
      }
      shipping_fee = SHIPPING_FEES[shipping_region];
      finalCourier = `J&T Express (${shipping_region})`;
    }

    // Parse items (accepts items_json or items field)
    let rawItems = [];
    const itemsPayload = items_json || req.body.items;
    try {
      rawItems = typeof itemsPayload === 'string' ? JSON.parse(itemsPayload) : itemsPayload;
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return res.status(400).json({ error: 'Your cart is empty' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid cart payload' });
    }

    // Resolve items with product records — price is always resolved authoritatively
    // server-side (per card number if applicable), never trusted from the client.
    const allProducts = await db.getProducts();
    const items = [];
    for (const rawItem of rawItems) {
      const prod = allProducts.find(p => p.id === rawItem.id);
      const cardNumber = (rawItem.card_number !== undefined && rawItem.card_number !== null && rawItem.card_number !== '')
        ? Number(rawItem.card_number)
        : undefined;
      const qty = cardNumber !== undefined ? 1 : Number(rawItem.qty || rawItem.quantity || 1);

      let price;
      if (cardNumber !== undefined && prod) {
        const card = await db.getCardByNumber(prod.id, cardNumber);
        price = db.resolveCardPrice(prod, card);
      } else {
        price = prod ? Number(prod.price) : Number(rawItem.price || 0);
      }

      items.push({
        id: rawItem.id,
        title: rawItem.title || (prod ? prod.title : 'Custom Trading Card'),
        price,
        qty: qty,
        quantity: qty,
        card_number: cardNumber,
        customization: rawItem.customization || null
      });
    }

    // Upload receipt to Cloud Storage / bucket (optional if paid via cash/counter)
    let receipt_url = '';
    if (req.file) {
      receipt_url = await storage.uploadFile(req.file, 'receipts');
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
    const total = subtotal + shipping_fee;
    const orderId = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    // Atomic execution with stock deduction
    const orderResult = await db.createOrderAtomic({
      orderId,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_address: customer_address.trim(),
      courier: finalCourier,
      payment_method,
      receipt_url,
      subtotal,
      shipping_fee,
      total,
      items
    });

    // Real-time sync to Google Sheets (if configured in .env)
    sendOrderToGoogleSheets({
      orderId,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_address: customer_address.trim(),
      courier: finalCourier,
      payment_method,
      receipt_url,
      subtotal,
      shipping_fee,
      total,
      items
    }).catch(err => console.error('Background sheets sync error:', err));

    res.status(201).json({
      success: true,
      order: {
        id: orderId,
        customer_name,
        total,
        courier: finalCourier,
        payment_method,
        receipt_url
      }
    });
  } catch (error) {
    console.error('Order creation error:', error);
    // If stock ran out or insufficient, return 409 Conflict
    const isStockError = error.message && (
      error.message.includes('stock') ||
      error.message.includes('Insufficient') ||
      error.message.includes('no longer available') ||
      error.message.includes('already been sold') ||
      error.message.includes('pending payment') ||
      error.message.includes('not available for selection') ||
      error.message.includes('does not exist')
    );
    res.status(isStockError ? 409 : 500).json({
      error: error.message || 'Failed to place order. Please try again.'
    });
  }
});

// ==========================================
// ADMIN ROUTES (Password-Gated)
// ==========================================

// Verify admin login credentials dynamically from Supabase
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const authResult = await db.verifyAdminCredentials(username, password);
    if (authResult.success) {
      return res.json({
        success: true,
        token: password,
        account: authResult.user?.username || username || ADMIN_USERNAME
      });
    }
    return res.status(401).json({ error: authResult.error || 'Incorrect admin password. Please try again.' });
  } catch (err) {
    console.error('Login route error:', err);
    return res.status(500).json({ error: 'Authentication service error' });
  }
});

// Add new product (Title, Price, Stock, Real Photo upload)
app.post('/api/admin/products', requireAdmin, upload.array('photos', 10), async (req, res) => {
  try {
    const { title, description, price, stock, category, card_numbering_enabled, card_number_start, card_number_end } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Product title is required' });
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Valid product price is required' });
    }

    const isNumbered = card_numbering_enabled === 'true' || card_numbering_enabled === true;
    let parsedStart = null;
    let parsedEnd = null;

    if (isNumbered) {
      parsedStart = parseInt(card_number_start, 10);
      parsedEnd = parseInt(card_number_end, 10);
      if (isNaN(parsedStart) || isNaN(parsedEnd) || parsedStart < 1 || parsedEnd < parsedStart) {
        return res.status(400).json({ error: 'Valid Start Number and End Number are required for a numbered product' });
      }
    }

    let parsedStock = 0;
    if (!isNumbered) {
      parsedStock = parseInt(stock, 10);
      if (isNaN(parsedStock) || parsedStock < 0) {
        return res.status(400).json({ error: 'Valid stock quantity is required' });
      }
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one product photo is required (No placeholder images permitted)' });
    }

    // Upload every photo in the batch
    const image_urls = await Promise.all(req.files.map(file => storage.uploadFile(file, 'products')));
    const id = 'prod_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    const product = await db.addProduct({
      id,
      title: title.trim(),
      description: (description && description.trim()) ? description.trim() : '',
      price: parsedPrice,
      stock: parsedStock,
      image_urls,
      category: (category && category.trim()) ? category.trim() : 'Food',
      card_numbering_enabled: isNumbered,
      card_number_start: parsedStart,
      card_number_end: parsedEnd
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Failed to add product: ' + error.message });
  }
});

// Edit an existing product's plain fields (title, price, category, stock).
// Photos are managed separately via the /photos routes below, and card
// numbering range changes go through the dedicated /card-range route —
// keeping them separate guarantees a plain edit can never touch card statuses.
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, stock, category } = req.body;

    const fields = {};

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ error: 'Product title is required' });
      }
      fields.title = title.trim();
    }

    if (description !== undefined) {
      fields.description = description.trim();
    }

    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: 'Valid product price is required' });
      }
      fields.price = parsedPrice;
    }

    if (category !== undefined && category.trim()) {
      fields.category = category.trim();
    }

    const product = await db.getProductById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Stock is only manually editable for non-numbered products; numbered stock is derived.
    if (stock !== undefined && !product.card_numbering_enabled) {
      const parsedStock = parseInt(stock, 10);
      if (!isNaN(parsedStock) && parsedStock >= 0) {
        fields.stock = parsedStock;
      }
    }

    const updated = await db.updateProduct(id, fields);
    res.json({ success: true, product: updated });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: error.message || 'Failed to update product' });
  }
});

// Add one or more photos to a product's gallery
app.post('/api/admin/products/:id/photos', requireAdmin, upload.array('photos', 10), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }
    const newUrls = await Promise.all(req.files.map(file => storage.uploadFile(file, 'products')));
    const product = await db.addProductImages(id, newUrls);
    res.json({ success: true, product });
  } catch (error) {
    console.error('Error adding product photos:', error);
    res.status(400).json({ error: error.message || 'Failed to add photos' });
  }
});

// Remove one photo from a product's gallery
app.post('/api/admin/products/:id/photos/remove', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Photo url is required' });
    }
    const product = await db.removeProductImage(id, url);
    res.json({ success: true, product });
  } catch (error) {
    console.error('Error removing product photo:', error);
    res.status(400).json({ error: error.message || 'Failed to remove photo' });
  }
});

// Enable/disable card numbering or change its Start/End range. Never resets
// existing card statuses — see db.updateCardRange for the guard rules.
app.put('/api/admin/products/:id/card-range', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { card_numbering_enabled, card_number_start, card_number_end } = req.body;

    if (card_numbering_enabled === false) {
      const product = await db.updateCardRange(id, { card_numbering_enabled: false });
      return res.json({ success: true, product });
    }

    const parsedStart = parseInt(card_number_start, 10);
    const parsedEnd = parseInt(card_number_end, 10);
    if (isNaN(parsedStart) || isNaN(parsedEnd) || parsedStart < 1 || parsedEnd < parsedStart) {
      return res.status(400).json({ error: 'Valid Start Number and End Number are required' });
    }

    const product = await db.updateCardRange(id, {
      card_numbering_enabled: true,
      card_number_start: parsedStart,
      card_number_end: parsedEnd
    });
    res.json({ success: true, product });
  } catch (error) {
    console.error('Error updating card range:', error);
    res.status(400).json({ error: error.message || 'Failed to update card number range' });
  }
});

// Paginated / searchable / filterable list of a product's card numbers (admin "Manage Card Numbers")
app.get('/api/admin/products/:id/cards', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 'All', search = '', page = '1', pageSize = '50' } = req.query;
    const result = await db.listProductCards(id, {
      status,
      search,
      page: parseInt(page, 10) || 1,
      pageSize: Math.min(parseInt(pageSize, 10) || 50, 200)
    });
    res.json(result);
  } catch (error) {
    console.error('Error listing product cards:', error);
    res.status(500).json({ error: 'Failed to load card numbers' });
  }
});

// Admin manual override: mark a single card AVAILABLE, SOLD_OUT or DISABLED directly.
app.post('/api/admin/products/:id/cards/:number/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const cardNumber = parseInt(req.params.number, 10);
    const { status } = req.body;
    if (isNaN(cardNumber)) {
      return res.status(400).json({ error: 'Invalid card number' });
    }
    const card = await db.adminSetCardStatus(id, cardNumber, status);
    res.json({ success: true, card });
  } catch (error) {
    console.error('Error updating card status:', error);
    res.status(400).json({ error: error.message || 'Failed to update card status' });
  }
});

// Admin: set custom prices for one or many card numbers at once (used by the
// single-row price edit and the "paste your price list" bulk importer).
app.post('/api/admin/products/:id/cards/bulk-price', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { prices } = req.body;
    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ error: 'No prices provided' });
    }
    const result = await db.setCardPrices(id, prices);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error setting card prices:', error);
    res.status(400).json({ error: error.message || 'Failed to set card prices' });
  }
});

// Remove product
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteProduct(id);
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: error.message || 'Failed to delete product' });
  }
});

// View all orders
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await db.getOrders();
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

// Update order status (Pending, Paid, Shipped, Cancelled). Card-aware: see
// db.updateOrderStatus — moving Pending -> Paid sells any numbered cards on
// the order; moving Pending -> anything else releases them back to Available.
app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    await db.updateOrderStatus(id, status);

    // Sync status change to Google Sheets in real-time
    updateOrderStatusInGoogleSheets(id, status).catch(err =>
      console.error('Error syncing status change to Google Sheets:', err)
    );

    res.json({ success: true, status });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(400).json({ error: error.message || 'Failed to update order status' });
  }
});

// Admin: verify payment and finalize the sale. The ONLY action that ever
// moves a numbered card from PENDING_PAYMENT to SOLD_OUT.
app.post('/api/admin/orders/:id/mark-paid', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await db.approveOrderPayment(id);

    updateOrderStatusInGoogleSheets(id, 'Paid').catch(err =>
      console.error('Error syncing status change to Google Sheets:', err)
    );

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error marking order as paid:', error);
    res.status(400).json({ error: error.message || 'Failed to mark order as paid' });
  }
});

// Admin: reject the payment (with an optional reason). Releases any numbered
// cards on the order back to AVAILABLE.
app.post('/api/admin/orders/:id/reject-payment', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const order = await db.rejectOrderPayment(id, reason || '');

    updateOrderStatusInGoogleSheets(id, 'Cancelled').catch(err =>
      console.error('Error syncing status change to Google Sheets:', err)
    );

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error rejecting order payment:', error);
    res.status(400).json({ error: error.message || 'Failed to reject payment' });
  }
});

// Clear all customer transactions
app.delete('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    await db.clearOrders();
    res.json({ success: true, message: 'All customer transactions have been cleared.' });
  } catch (error) {
    console.error('Error clearing customer transactions:', error);
    res.status(500).json({ error: 'Failed to clear customer transactions' });
  }
});

// Delete single order
app.delete('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteOrder(id);
    res.json({ success: true, message: `Order #${id} deleted.` });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// "Reset for new batch" — Clears all products only, keeps order history intact
app.post('/api/admin/batch-reset', requireAdmin, async (req, res) => {
  try {
    await db.resetProductsOnly();
    res.json({ success: true, message: 'All products reset for new batch. Order history is intact.' });
  } catch (error) {
    console.error('Error resetting batch:', error);
    res.status(500).json({ error: 'Failed to reset batch' });
  }
});

// Export all orders to CSV
app.get('/api/admin/orders/export', requireAdmin, async (req, res) => {
  try {
    const orders = await db.getOrders();

    const headers = [
      'Order ID',
      'Date',
      'Status',
      'Name of Product',
      'Card Number',
      'Price',
      'Quantity',
      'Phone Number',
      'Location / Address',
      'Courier',
      'Mode of Payment',
      'Subtotal',
      'Shipping',
      'Grand Total',
      'Photo of Receipt'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = [];
    orders.forEach(o => {
      const items = Array.isArray(o.items) && o.items.length > 0 ? o.items : [{ title: 'N/A', price: o.subtotal, qty: 1 }];

      items.forEach((item, index) => {
        rows.push([
          escapeCsv(o.id),
          escapeCsv(o.created_at),
          escapeCsv(o.status || 'Pending'),
          escapeCsv(item.title),
          escapeCsv(item.card_number !== undefined && item.card_number !== null ? `#${item.card_number}` : ''),
          escapeCsv(item.price),
          escapeCsv(item.qty),
          escapeCsv(o.customer_phone),
          escapeCsv(o.customer_address),
          escapeCsv(o.courier),
          escapeCsv(o.payment_method),
          escapeCsv(index === 0 ? o.subtotal : ''),
          escapeCsv(index === 0 ? o.shipping_fee : ''),
          escapeCsv(index === 0 ? o.total : ''),
          escapeCsv(o.receipt_url)
        ].join(','));
      });
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders-batch-${Date.now()}.csv"`);
    res.status(200).send('\uFEFF' + csvContent); // BOM for perfect Excel/Google Sheets UTF-8 display
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Export all orders to a real Excel (.xlsx) workbook
app.get('/api/admin/orders/export-excel', requireAdmin, async (req, res) => {
  try {
    const orders = await db.getOrders();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ICONIC Admin';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Orders');

    sheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 22 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Name of Product', key: 'product', width: 40 },
      { header: 'Card Number', key: 'cardNumber', width: 12 },
      { header: 'Price', key: 'price', width: 12 },
      { header: 'Quantity', key: 'qty', width: 10 },
      { header: 'Phone Number', key: 'phone', width: 16 },
      { header: 'Location / Address', key: 'address', width: 32 },
      { header: 'Courier', key: 'courier', width: 22 },
      { header: 'Mode of Payment', key: 'payment', width: 16 },
      { header: 'Subtotal', key: 'subtotal', width: 12 },
      { header: 'Shipping', key: 'shipping', width: 12 },
      { header: 'Grand Total', key: 'total', width: 14 },
      { header: 'Photo of Receipt', key: 'receipt', width: 40 }
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1EAE2' } };

    orders.forEach(o => {
      const items = Array.isArray(o.items) && o.items.length > 0 ? o.items : [{ title: 'N/A', price: o.subtotal, qty: 1 }];
      items.forEach((item, index) => {
        sheet.addRow({
          orderId: o.id,
          date: o.created_at ? new Date(o.created_at) : '',
          status: o.status || 'Pending',
          product: item.title,
          cardNumber: item.card_number !== undefined && item.card_number !== null ? `#${item.card_number}` : '',
          price: Number(item.price) || 0,
          qty: Number(item.qty) || 0,
          phone: o.customer_phone,
          address: o.customer_address,
          courier: o.courier,
          payment: o.payment_method,
          subtotal: index === 0 ? (Number(o.subtotal) || 0) : '',
          shipping: index === 0 ? (Number(o.shipping_fee) || 0) : '',
          total: index === 0 ? (Number(o.total) || 0) : '',
          receipt: o.receipt_url || ''
        });
      });
    });

    sheet.getColumn('date').numFmt = 'yyyy-mm-dd hh:mm';
    ['price', 'subtotal', 'shipping', 'total'].forEach(key => {
      sheet.getColumn(key).numFmt = '#,##0.00';
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="orders-batch-${Date.now()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({ error: 'Failed to export Excel file' });
  }
});

// Dedicated Admin Route
app.get(['/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Dedicated Order Tracking Route — every order gets its own /track/<id> link
app.get(['/track', '/track.html', '/track/:id'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'track.html'));
});

// Fallback SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Serverless platforms (Vercel, etc.) import this module and call the
// exported app directly as the request handler — they never run this file
// with `node server/index.js` themselves, so app.listen() below is skipped
// there and only matters for local dev / a traditional Node host.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Order Now app is running at http://localhost:${PORT}`);
  });

  // Periodic sweep: auto-cancel Pending orders whose payment was never verified
  // within PENDING_ORDER_EXPIRY_HOURS, releasing their numbered cards back to
  // Available. Only meaningful on a long-running process — serverless function
  // instances are too short-lived/ephemeral for setInterval to fire reliably.
  setInterval(() => {
    db.sweepExpiredPendingOrders(PENDING_ORDER_EXPIRY_HOURS).catch(err =>
      console.error('[Pending order expiry sweep] error:', err.message)
    );
  }, 15 * 60 * 1000);
}

export default app;
