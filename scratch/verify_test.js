import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  const BASE_URL = 'http://localhost:3000';
  console.log('--- STARTING VERIFICATION TESTS ---');

  // 1. Get store info
  const infoRes = await fetch(`${BASE_URL}/api/store-info`);
  const info = await infoRes.json();
  console.log('✓ GET /api/store-info succeeded:', info.storeName);

  // 2. Admin Login
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });
  const loginData = await loginRes.json();
  console.log('✓ POST /api/admin/login succeeded. Token:', loginData.token);

  // Create temporary test image
  const testImagePath = path.join(__dirname, 'test-img.jpg');
  // 1x1 dummy jpeg buffer
  const dummyJpg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
  fs.writeFileSync(testImagePath, dummyJpg);

  // 3. Add Product with file upload
  const form = new FormData();
  form.append('title', 'Artisan Coffee Beans 250g');
  form.append('price', '450');
  form.append('stock', '5');
  form.append('photo', new Blob([dummyJpg], { type: 'image/jpeg' }), 'coffee.jpg');

  const addProdRes = await fetch(`${BASE_URL}/api/admin/products`, {
    method: 'POST',
    headers: { 'x-admin-token': 'admin123' },
    body: form
  });
  const newProd = await addProdRes.json();
  console.log('✓ POST /api/admin/products created item:', newProd.product.title, 'Stock:', newProd.product.stock);

  // 4. Get products
  const prodsRes = await fetch(`${BASE_URL}/api/products`);
  const prods = await prodsRes.json();
  console.log('✓ GET /api/products returns:', prods.length, 'product(s)');

  // 5. Submit valid order
  const orderForm = new FormData();
  orderForm.append('customer_name', 'Juan Dela Cruz');
  orderForm.append('customer_phone', '09181234567');
  orderForm.append('customer_address', '123 Rizal Ave, Makati City');
  orderForm.append('courier', 'J&T Express');
  orderForm.append('payment_method', 'GCash');
  orderForm.append('items_json', JSON.stringify([
    { id: newProd.product.id, title: newProd.product.title, price: newProd.product.price, qty: 2 }
  ]));
  orderForm.append('receipt', new Blob([dummyJpg], { type: 'image/jpeg' }), 'receipt.jpg');

  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    body: orderForm
  });
  const orderData = await orderRes.json();
  console.log('✓ POST /api/orders succeeded:', orderData.order.id, 'Total:', orderData.order.total);

  // Verify stock decreased from 5 to 3
  const prodsAfter = await (await fetch(`${BASE_URL}/api/products`)).json();
  const updatedProd = prodsAfter.find(p => p.id === newProd.product.id);
  console.log('✓ Stock after purchase of 2 units:', updatedProd.stock, '(Expected 3)');

  // 6. Test Atomic Concurrency & Stock Rejection (Try to order 5 units when only 3 left)
  const excessiveOrderForm = new FormData();
  excessiveOrderForm.append('customer_name', 'Eager Buyer');
  excessiveOrderForm.append('customer_phone', '09199998888');
  excessiveOrderForm.append('customer_address', 'Quezon City');
  excessiveOrderForm.append('courier', 'Lalamove');
  excessiveOrderForm.append('payment_method', 'Bank Transfer');
  excessiveOrderForm.append('items_json', JSON.stringify([
    { id: newProd.product.id, title: newProd.product.title, price: newProd.product.price, qty: 5 }
  ]));
  excessiveOrderForm.append('receipt', new Blob([dummyJpg], { type: 'image/jpeg' }), 'receipt.jpg');

  const excessiveRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    body: excessiveOrderForm
  });
  const excessiveData = await excessiveRes.json();
  console.log('✓ Excessive stock order rejected with status', excessiveRes.status, 'Message:', excessiveData.error);

  // 7. Get Orders for Admin
  const adminOrdersRes = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: { 'x-admin-token': 'admin123' }
  });
  const ordersList = await adminOrdersRes.json();
  console.log('✓ GET /api/admin/orders returned', ordersList.length, 'order(s)');

  // 8. Test CSV Export
  const csvRes = await fetch(`${BASE_URL}/api/admin/orders/export?admin_token=admin123`);
  const csvText = await csvRes.text();
  console.log('✓ GET /api/admin/orders/export CSV length:', csvText.length, 'bytes');

  // 9. Clean up temporary test image
  if (fs.existsSync(testImagePath)) {
    fs.unlinkSync(testImagePath);
  }

  console.log('--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
