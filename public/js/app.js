/**
 * RESPONSIVE DUAL-MODE POINT OF SALE (POS) APPLICATION
 * Replicates:
 * - Mobile UI (< 1024px): Card steppers (- [qty] +), Orange checkmarks, Floating Cart Bar, Bottom Dock Navigation
 * - Web Desktop UI (>= 1024px): 3-Column POS (Left Navigation Sidebar, Responsive Grid, Right Fixed Order Ticket Panel)
 * - Shared real-time state: Adding/removing items dynamically synchronizes both desktop ticket list and mobile floating drawer.
 *
 * Every "+" click opens the Product Options modal (image/price + Card Number
 * selector for numbered products + Quantity). Cart lines are keyed by
 * productId for plain products, and by `${productId}::${cardNumber}` for
 * numbered ones — each specific card number is its own independent line,
 * since one card number can only ever be purchased once.
 */

// Application State (Isolated per customer session)
function generateTicketId() {
  return `#${Math.floor(1000 + Math.random() * 9000)}`;
}

const posState = {
  products: [],
  cart: {}, // lineKey -> { id, title, price, qty, image_url, category, card_number? }
  activeCategory: 'All',
  searchQuery: '',
  courier: 'Lalamove',
  ticketId: generateTicketId(),
  receiptFile: null,
  optionsModal: null, // { productId, isNumbered, currentNumber, cardStatus, qty }
  lightboxImages: [],
  lightboxIndex: 0
};

// DOM References
const DOM = {
  posSearchInput: document.getElementById('posSearchInput'),
  categoryGrid: document.getElementById('categoryGrid'),
  dishesGrid: document.getElementById('dishesGrid'),
  noProductsNotice: document.getElementById('noProductsNotice'),

  // Floating Cart Bar (Mobile)
  mobileFloatingCartBar: document.getElementById('mobileFloatingCartBar'),
  cartBarItemsCount: document.getElementById('cartBarItemsCount'),
  cartBarTotalPrice: document.getElementById('cartBarTotalPrice'),
  btnOpenCartModal: document.getElementById('btnOpenCartModal'),
  btnCartNext: document.getElementById('btnCartNext'),

  // Desktop Order Panel (Web Desktop)
  desktopTicketNum: document.getElementById('desktopTicketNum'),
  desktopOrderTime: document.getElementById('desktopOrderTime'),
  desktopTicketList: document.getElementById('desktopTicketList'),
  deskSubTotal: document.getElementById('deskSubTotal'),
  deskServiceCharge: document.getElementById('deskServiceCharge'),
  deskTax: document.getElementById('deskTax'),
  deskGrandTotal: document.getElementById('deskGrandTotal'),
  btnDeskCheckout: document.getElementById('btnDeskCheckout'),

  // Bottom Navigation (Mobile)
  dockOrdersBtn: document.getElementById('dockOrdersBtn'),
  dockCartBadge: document.getElementById('dockCartBadge'),

  // Checkout Modal
  checkoutModal: document.getElementById('checkoutModal'),
  checkoutModalTitle: document.getElementById('checkoutModalTitle'),
  closeCheckoutBtn: document.getElementById('closeCheckoutBtn'),
  modalItemsReviewList: document.getElementById('modalItemsReviewList'),
  checkoutForm: document.getElementById('checkoutForm'),
  custFullName: document.getElementById('custFullName'),
  custFullNameError: document.getElementById('custFullNameError'),
  custPhone: document.getElementById('custPhone'),
  custPhoneError: document.getElementById('custPhoneError'),
  custAddress: document.getElementById('custAddress'),
  custOrderSource: document.getElementById('custOrderSource'),
  custOrderSourceName: document.getElementById('custOrderSourceName'),
  custOrderSourceNameError: document.getElementById('custOrderSourceNameError'),
  custCourier: document.getElementById('custCourier'),
  courierHint: document.getElementById('courierHint'),
  custShippingRegionGroup: document.getElementById('custShippingRegionGroup'),
  custShippingRegion: document.getElementById('custShippingRegion'),
  custShippingRegionError: document.getElementById('custShippingRegionError'),
  custPayment: document.getElementById('custPayment'),
  modalTotalCharge: document.getElementById('modalTotalCharge'),
  receiptUploadBox: document.getElementById('receiptUploadBox'),
  receiptError: document.getElementById('receiptError'),
  receiptFile: document.getElementById('receiptFile'),
  receiptPreview: document.getElementById('receiptPreview'),
  receiptPreviewImg: document.getElementById('receiptPreviewImg'),
  receiptPreviewName: document.getElementById('receiptPreviewName'),
  clearReceiptBtn: document.getElementById('clearReceiptBtn'),
  submitOrderBtn: document.getElementById('submitOrderBtn'),

  // Success Modal
  successModal: document.getElementById('successModal'),
  successOrderId: document.getElementById('successOrderId'),
  successCustomerName: document.getElementById('successCustomerName'),
  successTotal: document.getElementById('successTotal'),
  successCourier: document.getElementById('successCourier'),
  successTrackLink: document.getElementById('successTrackLink'),
  successDoneBtn: document.getElementById('successDoneBtn'),

  // Lightbox
  lightboxModal: document.getElementById('lightboxModal'),
  lightboxImg: document.getElementById('lightboxImg'),
  closeLightboxBtn: document.getElementById('closeLightboxBtn'),
  lightboxPrevBtn: document.getElementById('lightboxPrevBtn'),
  lightboxNextBtn: document.getElementById('lightboxNextBtn'),
  lightboxCounter: document.getElementById('lightboxCounter'),

  // Product Options Modal
  productOptionsModal: document.getElementById('productOptionsModal'),
  closeOptionsModalBtn: document.getElementById('closeOptionsModalBtn'),
  optionsProdImg: document.getElementById('optionsProdImg'),
  optionsProdTitle: document.getElementById('optionsProdTitle'),
  optionsProdPrice: document.getElementById('optionsProdPrice'),
  optionsProdDescription: document.getElementById('optionsProdDescription'),
  optionsCardNumberSection: document.getElementById('optionsCardNumberSection'),
  cardNumberSearchInput: document.getElementById('cardNumberSearchInput'),
  cardNumberPrevBtn: document.getElementById('cardNumberPrevBtn'),
  cardNumberNextBtn: document.getElementById('cardNumberNextBtn'),
  cardNumberCurrent: document.getElementById('cardNumberCurrent'),
  cardNumberRangeEnd: document.getElementById('cardNumberRangeEnd'),
  cardNumberStatusLine: document.getElementById('cardNumberStatusLine'),
  optionsQtyLabel: document.getElementById('optionsQtyLabel'),
  optionsQtyStepperWrap: document.getElementById('optionsQtyStepperWrap'),
  optionsQtyMinusBtn: document.getElementById('optionsQtyMinusBtn'),
  optionsQtyPlusBtn: document.getElementById('optionsQtyPlusBtn'),
  optionsQtyVal: document.getElementById('optionsQtyVal'),
  optionsQtyHint: document.getElementById('optionsQtyHint'),
  optionsAddToCartBtn: document.getElementById('optionsAddToCartBtn'),

  toastContainer: document.getElementById('toastContainer')
};

// Formatting Helper
function formatPrice(amount) {
  return '₱' + Number(amount || 0).toFixed(2);
}

// J&T Express charges a flat fee by region (mirrors the server, which is
// the actual authority on the charged amount — this is just for the live
// total preview). Lalamove has no fee here since that's paid to the rider
// directly on delivery, never added to the order total.
const SHIPPING_FEES = { Luzon: 75, Visayas: 90, Mindanao: 120 };

function getSelectedShippingFee() {
  const courier = DOM.custCourier ? DOM.custCourier.value : 'Lalamove';
  if (courier !== 'J&T Express') return 0;
  const region = DOM.custShippingRegion ? DOM.custShippingRegion.value : '';
  return SHIPPING_FEES[region] || 0;
}

function getCartSubtotal() {
  let subtotal = 0;
  for (const item of Object.values(posState.cart)) {
    subtotal += item.price * item.qty;
  }
  return subtotal;
}

function updateCheckoutGrandTotal() {
  if (!DOM.modalTotalCharge) return;
  DOM.modalTotalCharge.innerText = formatPrice(getCartSubtotal() + getSelectedShippingFee());
}

// Toggle the region picker + explanatory hint whenever the courier changes.
function updateCourierUI() {
  const courier = DOM.custCourier ? DOM.custCourier.value : 'Lalamove';
  const isJnt = courier === 'J&T Express';
  if (DOM.custShippingRegionGroup) DOM.custShippingRegionGroup.style.display = isJnt ? 'block' : 'none';
  if (DOM.courierHint) {
    DOM.courierHint.innerText = isJnt
      ? 'Select your region below — the shipping fee will be added to your total.'
      : 'Shipping fee is paid directly to the rider upon delivery.';
  }
  updateCheckoutGrandTotal();
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = DOM.toastContainer;
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `pos-toast toast-${type}`;
  toast.innerText = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format Live Time for Desktop Ticket Panel
function updateDesktopTicketTime() {
  if (!DOM.desktopOrderTime) return;
  const now = new Date();
  const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  DOM.desktopOrderTime.innerText = now.toLocaleDateString('en-US', options).toUpperCase();
  if (DOM.desktopTicketNum) {
    DOM.desktopTicketNum.innerText = posState.ticketId;
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateDesktopTicketTime();
  loadCatalogProducts();
});

// Fetch Products from API
async function loadCatalogProducts() {
  try {
    const products = await API.getProducts();
    posState.products = products || [];
    renderCategoryPills(posState.products);
    renderDishesGrid();
  } catch (err) {
    console.warn('Failed to load products from API:', err);
    posState.products = [];
    renderCategoryPills([]);
    renderDishesGrid();
  }
}

// Dynamically Render Category Filter Pills from database items
function renderCategoryPills(products) {
  if (!DOM.categoryGrid) return;
  const categories = new Set(['All']);
  (products || []).forEach(p => {
    if (p.category && p.category.trim()) {
      categories.add(p.category.trim());
    }
  });

  DOM.categoryGrid.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cat-pill-btn ${cat === posState.activeCategory ? 'active' : ''}`;
    btn.setAttribute('data-category', cat);
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      DOM.categoryGrid.querySelectorAll('.cat-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      posState.activeCategory = cat;
      renderDishesGrid();
    });
    DOM.categoryGrid.appendChild(btn);
  });
}

// Sum cart quantity across all lines belonging to a product (a numbered
// product can have several independent lines, one per card number).
function getCartQtyForProduct(productId) {
  return Object.values(posState.cart)
    .filter(item => String(item.id) === String(productId))
    .reduce((sum, item) => sum + item.qty, 0);
}

// Render Dishes/Cards Grid matching screenshot
function renderDishesGrid() {
  if (!DOM.dishesGrid) return;
  DOM.dishesGrid.innerHTML = '';

  const query = (posState.searchQuery || '').toLowerCase().trim();
  const cat = posState.activeCategory;

  const filtered = posState.products.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(query);
    const itemCat = (p.category || 'Cards').toLowerCase();
    const matchCategory = (cat === 'All') || (itemCat === cat.toLowerCase());
    return matchSearch && matchCategory;
  });

  if (posState.products.length === 0) {
    if (DOM.noProductsNotice) {
      DOM.noProductsNotice.style.display = 'block';
      const titleEl = DOM.noProductsNotice.querySelector('.empty-state-title');
      const subEl = DOM.noProductsNotice.querySelector('.empty-state-sub');
      if (titleEl) titleEl.innerText = 'None';
      if (subEl) subEl.innerText = 'No items available at this time.';
    }
    updateAllCartViews();
    return;
  }

  if (filtered.length === 0) {
    if (DOM.noProductsNotice) {
      DOM.noProductsNotice.style.display = 'block';
      const titleEl = DOM.noProductsNotice.querySelector('.empty-state-title');
      const subEl = DOM.noProductsNotice.querySelector('.empty-state-sub');
      if (titleEl) titleEl.innerText = 'None';
      if (subEl) subEl.innerText = `No items found under "${cat}".`;
    }
    updateAllCartViews();
    return;
  }

  if (DOM.noProductsNotice) DOM.noProductsNotice.style.display = 'none';

  filtered.forEach(p => {
    const card = document.createElement('div');
    const cartQty = getCartQtyForProduct(p.id);
    const isSelected = cartQty > 0;
    const isNumbered = Boolean(p.card_numbering_enabled);
    const isSoldOut = isNumbered ? Number(p.card_available_count) <= 0 : Number(p.stock) <= 0;

    card.className = `dish-mobile-card ${isSelected ? 'selected-active' : ''}`;
    card.id = `mobile-dish-${p.id}`;

    let actionHtml;
    if (isSoldOut && !isSelected) {
      actionHtml = `<span class="btn-sold-out-pill${isNumbered ? ' full-width' : ''}">Sold Out</span>`;
    } else if (isSelected) {
      actionHtml = `
        <button type="button" class="btn-numbered-chip${isNumbered ? ' full-width' : ''}" onclick="openProductOptionsModal('${p.id}')" title="Edit selection">
          ${cartQty} in cart
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
      `;
    } else if (isNumbered) {
      actionHtml = `<button type="button" class="btn-add-to-cart-text" onclick="openProductOptionsModal('${p.id}')">Add to Cart</button>`;
    } else {
      actionHtml = `<button type="button" class="btn-initial-add" onclick="openProductOptionsModal('${p.id}')" title="Add to cart">+</button>`;
    }

    card.innerHTML = `
      ${isSelected ? `<div class="card-checked-badge"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
      <div class="dish-img-box" onclick="openProductGallery('${p.id}')">
        <img src="${p.image_url}" alt="${p.title}" class="dish-photo" loading="lazy">
      </div>
      <h3 class="dish-title-text" title="Click to view full details" onclick="openProductOptionsModal('${p.id}')">${p.title}</h3>
      ${p.description ? `<p class="dish-desc-text" title="Click to view full details" onclick="openProductOptionsModal('${p.id}')">${p.description}</p>` : ''}
      <div class="card-bottom-bar">
        ${isNumbered ? '' : `<span class="card-price-display">${formatPrice(p.price)}</span>`}
        ${actionHtml}
      </div>
    `;

    DOM.dishesGrid.appendChild(card);
  });

  updateAllCartViews();
}

// ==========================================================================
// PRODUCT OPTIONS MODAL (opens on every "+" click; Card Number section only
// shown for products with card numbering enabled)
// ==========================================================================

window.openProductOptionsModal = function(productId) {
  const prod = posState.products.find(p => String(p.id) === String(productId));
  if (!prod) return;

  const isNumbered = Boolean(prod.card_numbering_enabled);
  if (isNumbered && Number(prod.card_available_count) <= 0) {
    showToast(`"${prod.title}" is sold out`, 'error');
    return;
  }
  if (!isNumbered && Number(prod.stock) <= 0) {
    showToast(`"${prod.title}" is currently out of stock`, 'error');
    return;
  }

  posState.optionsModal = {
    productId,
    isNumbered,
    currentNumber: isNumbered ? Number(prod.card_number_start) : null,
    cardStatus: null,
    cardPrice: null,
    qty: isNumbered ? 1 : (posState.cart[productId] ? posState.cart[productId].qty : 1)
  };

  if (DOM.optionsProdImg) DOM.optionsProdImg.src = prod.image_url;
  if (DOM.optionsProdTitle) DOM.optionsProdTitle.innerText = prod.title;
  // Numbered products have no flat price — show a placeholder until the
  // selected card number's real price loads, instead of flashing "$0.00".
  if (DOM.optionsProdPrice) DOM.optionsProdPrice.innerText = isNumbered ? 'Loading price...' : formatPrice(prod.price);
  if (DOM.optionsProdDescription) {
    DOM.optionsProdDescription.innerText = prod.description || '';
    DOM.optionsProdDescription.style.display = prod.description ? 'block' : 'none';
  }

  if (isNumbered) {
    if (DOM.optionsCardNumberSection) DOM.optionsCardNumberSection.style.display = 'block';
    if (DOM.cardNumberRangeEnd) DOM.cardNumberRangeEnd.innerText = prod.card_number_end;
    if (DOM.cardNumberSearchInput) {
      DOM.cardNumberSearchInput.value = '';
      DOM.cardNumberSearchInput.min = prod.card_number_start;
      DOM.cardNumberSearchInput.max = prod.card_number_end;
    }
    updateCardNumberDisplay();
    refreshCardNumberStatus();
  } else if (DOM.optionsCardNumberSection) {
    DOM.optionsCardNumberSection.style.display = 'none';
  }

  if (DOM.optionsQtyMinusBtn) DOM.optionsQtyMinusBtn.disabled = isNumbered;
  if (DOM.optionsQtyPlusBtn) DOM.optionsQtyPlusBtn.disabled = isNumbered;
  if (DOM.optionsQtyLabel) DOM.optionsQtyLabel.style.display = isNumbered ? 'none' : 'block';
  if (DOM.optionsQtyStepperWrap) DOM.optionsQtyStepperWrap.style.display = isNumbered ? 'none' : 'flex';
  if (DOM.optionsQtyHint) DOM.optionsQtyHint.style.display = isNumbered ? 'block' : 'none';
  if (DOM.optionsQtyVal) DOM.optionsQtyVal.innerText = posState.optionsModal.qty;

  updateOptionsAddButton();

  if (DOM.productOptionsModal) DOM.productOptionsModal.classList.add('active');
};

function updateCardNumberDisplay() {
  if (DOM.cardNumberCurrent && posState.optionsModal) {
    DOM.cardNumberCurrent.innerText = posState.optionsModal.currentNumber;
  }
}

// Card availability is never trusted from stale frontend state — every time
// the displayed number changes, re-check its live status from the server.
async function refreshCardNumberStatus() {
  const m = posState.optionsModal;
  if (!m) return;
  const requestedNumber = m.currentNumber; // snapshot: detect if the user moved on before this resolves

  if (DOM.cardNumberStatusLine) {
    DOM.cardNumberStatusLine.className = 'card-number-status status-checking';
    DOM.cardNumberStatusLine.innerText = 'Checking availability...';
  }
  if (DOM.optionsAddToCartBtn) DOM.optionsAddToCartBtn.disabled = true;

  try {
    const result = await API.getCardStatus(m.productId, requestedNumber);
    if (!posState.optionsModal || posState.optionsModal.currentNumber !== requestedNumber) return; // stale response, user moved on
    posState.optionsModal.cardStatus = result.status;
    posState.optionsModal.cardPrice = result.price;
    if (DOM.optionsProdPrice) DOM.optionsProdPrice.innerText = formatPrice(result.price);
  } catch (err) {
    if (!posState.optionsModal || posState.optionsModal.currentNumber !== requestedNumber) return;
    posState.optionsModal.cardStatus = 'UNKNOWN';
  }

  renderCardNumberStatus();
  updateOptionsAddButton();
}

function renderCardNumberStatus() {
  if (!DOM.cardNumberStatusLine || !posState.optionsModal) return;
  const statusMap = {
    AVAILABLE: { text: '✓ Available', cls: 'status-available' },
    PENDING_PAYMENT: { text: 'Pending Payment — this card is currently being processed and cannot be selected.', cls: 'status-pending' },
    SOLD_OUT: { text: 'Sold Out — this card has already been sold.', cls: 'status-sold' },
    DISABLED: { text: 'Not available for selection.', cls: 'status-sold' },
    UNKNOWN: { text: 'Unable to check availability. Please try again.', cls: 'status-sold' }
  };
  const info = statusMap[posState.optionsModal.cardStatus] || statusMap.UNKNOWN;
  DOM.cardNumberStatusLine.innerText = info.text;
  DOM.cardNumberStatusLine.className = `card-number-status ${info.cls}`;
}

function updateOptionsAddButton() {
  const m = posState.optionsModal;
  if (!m || !DOM.optionsAddToCartBtn) return;
  const enabled = m.isNumbered ? (m.cardStatus === 'AVAILABLE') : true;
  DOM.optionsAddToCartBtn.disabled = !enabled;
}

function stepCardNumber(delta) {
  const m = posState.optionsModal;
  if (!m) return;
  const prod = posState.products.find(p => String(p.id) === String(m.productId));
  if (!prod) return;
  const next = Math.min(prod.card_number_end, Math.max(prod.card_number_start, m.currentNumber + delta));
  if (next === m.currentNumber) return;
  m.currentNumber = next;
  if (DOM.cardNumberSearchInput) DOM.cardNumberSearchInput.value = '';
  updateCardNumberDisplay();
  refreshCardNumberStatus();
}

function handleCardNumberSearch() {
  const m = posState.optionsModal;
  if (!m || !DOM.cardNumberSearchInput) return;
  const prod = posState.products.find(p => String(p.id) === String(m.productId));
  if (!prod) return;
  const raw = DOM.cardNumberSearchInput.value.trim();
  if (raw === '') return;
  const val = parseInt(raw, 10);
  if (isNaN(val)) return;
  const clamped = Math.min(prod.card_number_end, Math.max(prod.card_number_start, val));
  if (clamped === m.currentNumber) return; // already showing this number — avoid a redundant re-check (e.g. Enter then blur)
  m.currentNumber = clamped;
  updateCardNumberDisplay();
  refreshCardNumberStatus();
}

function adjustOptionsQty(delta) {
  const m = posState.optionsModal;
  if (!m || m.isNumbered) return;
  const prod = posState.products.find(p => String(p.id) === String(m.productId));
  const next = m.qty + delta;
  if (next < 0) return;
  if (prod && next > prod.stock) {
    showToast(`Only ${prod.stock} items left in stock`, 'error');
    return;
  }
  m.qty = next;
  if (DOM.optionsQtyVal) DOM.optionsQtyVal.innerText = m.qty;
}

function handleOptionsAddToCart() {
  const m = posState.optionsModal;
  if (!m) return;
  const prod = posState.products.find(p => String(p.id) === String(m.productId));
  if (!prod) return;

  if (m.isNumbered) {
    if (m.cardStatus !== 'AVAILABLE') {
      showToast(`Card #${m.currentNumber} is no longer available. Please select another card number.`, 'error');
      return;
    }
    const lineKey = `${prod.id}::${m.currentNumber}`;
    posState.cart[lineKey] = {
      id: prod.id,
      card_number: m.currentNumber,
      title: prod.title,
      price: Number(m.cardPrice !== null && m.cardPrice !== undefined ? m.cardPrice : prod.price),
      qty: 1,
      image_url: prod.image_url,
      category: prod.category || 'Cards'
    };
    showToast(`Card #${m.currentNumber} added to cart`, 'success');
  } else {
    if (m.qty <= 0) {
      delete posState.cart[prod.id];
    } else {
      posState.cart[prod.id] = {
        id: prod.id,
        title: prod.title,
        price: Number(prod.price),
        qty: m.qty,
        image_url: prod.image_url,
        category: prod.category || 'Cards'
      };
    }
  }

  closeOptionsModal();
  renderDishesGrid();
  renderModalReviewItems();
}

function closeOptionsModal() {
  if (DOM.productOptionsModal) DOM.productOptionsModal.classList.remove('active');
  posState.optionsModal = null;
}

// Remove a cart line entirely (used for both numbered and plain items' remove buttons)
window.removeCartLine = function(lineKey) {
  delete posState.cart[lineKey];
  renderDishesGrid();
  renderModalReviewItems();
};

// Adjust quantity of an already-in-cart plain (non-numbered) line
window.adjustCartLineQty = function(lineKey, delta) {
  const item = posState.cart[lineKey];
  if (!item || item.card_number !== undefined) return; // numbered lines don't support qty adjust
  const prod = posState.products.find(p => String(p.id) === String(item.id));
  const targetQty = item.qty + delta;
  if (targetQty <= 0) {
    delete posState.cart[lineKey];
  } else {
    if (prod && targetQty > prod.stock) {
      showToast(`Only ${prod.stock} items left in stock`, 'error');
      return;
    }
    item.qty = targetQty;
  }
  renderDishesGrid();
  renderModalReviewItems();
};

// Synchronize all Cart UIs (Mobile Floating Bar, Web Desktop Right Ticket Panel, Modal Reviews)
function updateAllCartViews() {
  let totalCount = 0;
  let totalPrice = 0;

  for (const item of Object.values(posState.cart)) {
    totalCount += item.qty;
    totalPrice += item.price * item.qty;
  }

  // 1. Mobile Floating Drawer
  if (DOM.cartBarItemsCount) DOM.cartBarItemsCount.innerText = `${totalCount} ${totalCount === 1 ? 'Item' : 'Items'}`;
  if (DOM.cartBarTotalPrice) DOM.cartBarTotalPrice.innerText = formatPrice(totalPrice);
  updateCheckoutGrandTotal();

  if (DOM.mobileFloatingCartBar) {
    if (totalCount > 0) {
      DOM.mobileFloatingCartBar.classList.remove('hidden');
    } else {
      DOM.mobileFloatingCartBar.classList.add('hidden');
    }
  }

  // Update Mobile Bottom Dock Cart Badge
  if (DOM.dockCartBadge) {
    DOM.dockCartBadge.innerText = totalCount;
    if (totalCount > 0) {
      DOM.dockCartBadge.classList.remove('hidden');
    } else {
      DOM.dockCartBadge.classList.add('hidden');
    }
  }

  // 2. Desktop Web Right Order Panel
  if (DOM.deskSubTotal) DOM.deskSubTotal.innerText = formatPrice(totalPrice);
  if (DOM.deskServiceCharge) DOM.deskServiceCharge.innerText = '₱0.00';
  if (DOM.deskTax) DOM.deskTax.innerText = '₱0.00';
  if (DOM.deskGrandTotal) DOM.deskGrandTotal.innerText = formatPrice(totalPrice);

  renderDesktopTicketList();

  return { totalCount, totalPrice };
}

// Render Desktop Right Order Panel Ticket Items
function renderDesktopTicketList() {
  if (!DOM.desktopTicketList) return;
  DOM.desktopTicketList.innerHTML = '';

  const entries = Object.entries(posState.cart);

  if (entries.length === 0) {
    DOM.desktopTicketList.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
        <div style="margin-bottom: 0.65rem; display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#d4d4d8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </div>
        <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-dark);">Your cart is empty</span>
        <span style="font-size: 0.78rem; margin-top: 0.25rem;">Click (+) on any card to add to your cart</span>
      </div>
    `;
    return;
  }

  entries.forEach(([lineKey, item]) => {
    const itemRow = document.createElement('div');
    itemRow.className = 'desk-ticket-item';
    const numberTagHtml = item.card_number !== undefined
      ? `<div class="cart-numbers-tags"><span class="cart-number-tag">#${item.card_number}</span></div>`
      : '';
    const controlsHtml = item.card_number !== undefined
      ? `<button type="button" class="desk-btn-mini" onclick="removeCartLine('${lineKey}')" title="Remove">&times;</button>`
      : `
        <button type="button" class="desk-btn-mini" onclick="adjustCartLineQty('${lineKey}', -1)" title="Decrease">–</button>
        <span class="desk-item-qty">${item.qty}</span>
        <button type="button" class="desk-btn-mini" onclick="adjustCartLineQty('${lineKey}', 1)" title="Increase">+</button>
      `;
    itemRow.innerHTML = `
      <img src="${item.image_url}" alt="${item.title}" class="desk-ticket-thumb">
      <div class="desk-ticket-info">
        <div class="desk-ticket-name" title="${item.title}">${item.title}</div>
        <div class="desk-ticket-unit-price">${formatPrice(item.price)} each &bull; <strong>${formatPrice(item.price * item.qty)}</strong></div>
        ${numberTagHtml}
      </div>
      <div class="desk-ticket-stepper">
        ${controlsHtml}
      </div>
    `;
    DOM.desktopTicketList.appendChild(itemRow);
  });
}

// Render Selected Items in Checkout Modal Review Box
function renderModalReviewItems() {
  if (!DOM.modalItemsReviewList) return;
  DOM.modalItemsReviewList.innerHTML = '';

  const entries = Object.entries(posState.cart);
  if (entries.length === 0) {
    if (DOM.checkoutModalTitle) {
      DOM.checkoutModalTitle.textContent = 'My Cart';
    }
    DOM.modalItemsReviewList.innerHTML = `
      <div class="empty-cart-modal-view">
        <div class="empty-cart-icon">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#e11d48" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </div>
        <h4 class="empty-cart-title">Nothing inside the cart</h4>
        <p class="empty-cart-sub">Your cart is currently empty. Explore our catalog and add cards to your cart.</p>
        <button type="button" class="btn-shop-now" id="btnModalShopNow">Shop Now</button>
      </div>
    `;
    if (DOM.checkoutForm) {
      DOM.checkoutForm.style.display = 'none';
    }
    const shopBtn = document.getElementById('btnModalShopNow');
    if (shopBtn) {
      shopBtn.addEventListener('click', () => {
        if (DOM.checkoutModal) DOM.checkoutModal.classList.remove('active');
      });
    }
    return;
  }

  if (DOM.checkoutModalTitle) {
    DOM.checkoutModalTitle.textContent = 'My Cart';
  }
  if (DOM.checkoutForm) {
    DOM.checkoutForm.style.display = 'block';
  }

  entries.forEach(([lineKey, item]) => {
    const row = document.createElement('div');
    row.className = 'review-item-row';
    const numberTagHtml = item.card_number !== undefined
      ? `<div class="cart-numbers-tags"><span class="cart-number-tag">#${item.card_number}</span></div>`
      : '';
    const controlsHtml = item.card_number !== undefined
      ? ''
      : `
        <div class="modal-qty-stepper">
          <button type="button" class="modal-qty-btn" onclick="adjustCartLineQty('${lineKey}', -1)" title="Decrease">−</button>
          <span class="modal-qty-val">${item.qty}</span>
          <button type="button" class="modal-qty-btn" onclick="adjustCartLineQty('${lineKey}', 1)" title="Increase">+</button>
        </div>
      `;
    row.innerHTML = `
      <div class="review-item-info">
        <strong class="review-item-title">${item.title}</strong>
        <span class="review-item-unit">${formatPrice(item.price)} each</span>
        ${numberTagHtml}
      </div>
      <div class="review-item-controls">
        ${controlsHtml}
        <span class="review-item-total">${formatPrice(item.price * item.qty)}</span>
        <button type="button" onclick="removeCartLine('${lineKey}')" class="review-item-remove" title="Remove">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
    DOM.modalItemsReviewList.appendChild(row);
  });
}

// Open Checkout Modal
function openCheckoutModal() {
  updateAllCartViews();
  renderModalReviewItems();
  if (DOM.checkoutModal) DOM.checkoutModal.classList.add('active');
}

// Setup Event Listeners
function setupEventListeners() {
  // Category Pill Selection
  if (DOM.categoryGrid) {
    DOM.categoryGrid.querySelectorAll('.cat-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.categoryGrid.querySelectorAll('.cat-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        posState.activeCategory = btn.getAttribute('data-category');
        renderDishesGrid();
      });
    });
  }

  // Live Search
  if (DOM.posSearchInput) {
    DOM.posSearchInput.addEventListener('input', (e) => {
      posState.searchQuery = e.target.value;
      renderDishesGrid();
    });
  }

  // Floating Cart Bar Action Buttons (Mobile)
  if (DOM.btnCartNext) {
    DOM.btnCartNext.addEventListener('click', openCheckoutModal);
  }
  if (DOM.btnOpenCartModal) {
    DOM.btnOpenCartModal.addEventListener('click', openCheckoutModal);
  }

  // Desktop Order Panel Checkout Button (Web Desktop)
  if (DOM.btnDeskCheckout) {
    DOM.btnDeskCheckout.addEventListener('click', openCheckoutModal);
  }

  // Mobile Bottom Dock Orders Button
  if (DOM.dockOrdersBtn) {
    DOM.dockOrdersBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openCheckoutModal();
    });
  }

  // Close Checkout Modal
  if (DOM.closeCheckoutBtn && DOM.checkoutModal) {
    DOM.closeCheckoutBtn.addEventListener('click', () => {
      DOM.checkoutModal.classList.remove('active');
    });
  }

  // Clear a field's error highlight as soon as the customer edits it
  if (DOM.custFullName) {
    DOM.custFullName.addEventListener('input', () => clearFieldError(DOM.custFullName, DOM.custFullNameError));
  }
  if (DOM.custPhone) {
    DOM.custPhone.addEventListener('input', () => clearFieldError(DOM.custPhone, DOM.custPhoneError));
  }
  if (DOM.custOrderSourceName) {
    DOM.custOrderSourceName.addEventListener('input', () => clearFieldError(DOM.custOrderSourceName, DOM.custOrderSourceNameError));
  }

  // Courier / Shipping Region: toggle the region picker + live Grand Total
  if (DOM.custCourier) {
    DOM.custCourier.addEventListener('change', updateCourierUI);
    updateCourierUI(); // set initial state to match the default selection
  }
  if (DOM.custShippingRegion) {
    DOM.custShippingRegion.addEventListener('change', () => {
      clearFieldError(DOM.custShippingRegion, DOM.custShippingRegionError);
      updateCheckoutGrandTotal();
    });
  }

  // Receipt Screenshot Upload UX
  if (DOM.receiptUploadBox && DOM.receiptFile) {
    DOM.receiptUploadBox.addEventListener('click', () => DOM.receiptFile.click());
    DOM.receiptFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) setReceiptPreview(file);
    });

    DOM.receiptUploadBox.addEventListener('paste', (e) => {
      const items = e.clipboardData ? e.clipboardData.items : [];
      for (const it of items) {
        if (it.type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = it.getAsFile();
          if (blob) {
            const ext = blob.type.split('/')[1] || 'png';
            const pastedFile = new File([blob], `receipt-${Date.now()}.${ext}`, { type: blob.type });
            setReceiptPreview(pastedFile);
            showToast('Receipt image attached!', 'success');
            break;
          }
        }
      }
    });
  }

  if (DOM.clearReceiptBtn) {
    DOM.clearReceiptBtn.addEventListener('click', resetReceiptPreview);
  }

  // Checkout Form Submission
  if (DOM.checkoutForm) {
    DOM.checkoutForm.addEventListener('submit', handleOrderSubmit);
  }

  // Success Modal Done
  if (DOM.successDoneBtn && DOM.successModal) {
    DOM.successDoneBtn.addEventListener('click', () => {
      DOM.successModal.classList.remove('active');
      posState.ticketId = generateTicketId();
      updateDesktopTicketTime();
    });
  }

  // Lightbox
  if (DOM.closeLightboxBtn && DOM.lightboxModal) {
    DOM.closeLightboxBtn.addEventListener('click', closeLightbox);
    DOM.lightboxModal.addEventListener('click', (e) => {
      if (e.target === DOM.lightboxModal) closeLightbox();
    });
  }
  if (DOM.lightboxPrevBtn) {
    DOM.lightboxPrevBtn.addEventListener('click', () => stepLightbox(-1));
  }
  if (DOM.lightboxNextBtn) {
    DOM.lightboxNextBtn.addEventListener('click', () => stepLightbox(1));
  }
  document.addEventListener('keydown', (e) => {
    if (!DOM.lightboxModal || !DOM.lightboxModal.classList.contains('active')) return;
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
    if (e.key === 'Escape') closeLightbox();
  });

  // Product Options Modal
  if (DOM.closeOptionsModalBtn) {
    DOM.closeOptionsModalBtn.addEventListener('click', closeOptionsModal);
  }
  if (DOM.optionsProdImg) {
    DOM.optionsProdImg.addEventListener('click', () => {
      if (posState.optionsModal) openProductGallery(posState.optionsModal.productId);
    });
  }
  if (DOM.optionsAddToCartBtn) {
    DOM.optionsAddToCartBtn.addEventListener('click', handleOptionsAddToCart);
  }
  if (DOM.cardNumberPrevBtn) {
    DOM.cardNumberPrevBtn.addEventListener('click', () => stepCardNumber(-1));
  }
  if (DOM.cardNumberNextBtn) {
    DOM.cardNumberNextBtn.addEventListener('click', () => stepCardNumber(1));
  }
  if (DOM.cardNumberSearchInput) {
    DOM.cardNumberSearchInput.addEventListener('change', handleCardNumberSearch);
    DOM.cardNumberSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCardNumberSearch();
      }
    });
  }
  if (DOM.optionsQtyMinusBtn) {
    DOM.optionsQtyMinusBtn.addEventListener('click', () => adjustOptionsQty(-1));
  }
  if (DOM.optionsQtyPlusBtn) {
    DOM.optionsQtyPlusBtn.addEventListener('click', () => adjustOptionsQty(1));
  }
}

// Receipt Preview Helpers

// Vercel serverless functions hard-cap request bodies around ~4.5MB — stay
// safely under that so an oversized receipt fails with a clear message here
// instead of a cryptic 413 from the platform after the request is sent.
const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;

function setReceiptPreview(file) {
  if (file.size > MAX_RECEIPT_BYTES) {
    showToast('That receipt image is too large (max 4MB). Please use a smaller screenshot.', 'error');
    return;
  }
  posState.receiptFile = file;
  DOM.receiptPreviewName.innerText = file.name || 'Receipt Image';
  DOM.receiptPreviewImg.src = URL.createObjectURL(file);
  DOM.receiptPreview.style.display = 'flex';
  DOM.receiptUploadBox.style.display = 'none';
  DOM.receiptUploadBox.classList.remove('has-error');
  if (DOM.receiptError) DOM.receiptError.style.display = 'none';
}

function resetReceiptPreview() {
  posState.receiptFile = null;
  DOM.receiptFile.value = '';
  DOM.receiptPreview.style.display = 'none';
  DOM.receiptUploadBox.style.display = 'block';
}

// A real full name, not just one word — e.g. "Maria Santos", not "Maria".
function isValidFullName(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.every(w => w.length >= 2);
}

// PH mobile numbers only: 09XXXXXXXXX (11 digits) or +639XXXXXXXXX.
function isValidPhPhone(phone) {
  const digits = phone.replace(/[\s\-()]/g, '');
  return /^(09\d{9}|\+639\d{9})$/.test(digits);
}

function setFieldError(inputEl, errorEl) {
  if (inputEl) inputEl.classList.add('has-error');
  if (errorEl) errorEl.style.display = 'block';
}

function clearFieldError(inputEl, errorEl) {
  if (inputEl) inputEl.classList.remove('has-error');
  if (errorEl) errorEl.style.display = 'none';
}

// Handle Order Submit
async function handleOrderSubmit(e) {
  e.preventDefault();

  const customerName = DOM.custFullName.value.trim();
  const customerPhone = DOM.custPhone.value.trim();
  const customerAddress = DOM.custAddress.value.trim();
  const orderSource = DOM.custOrderSource ? DOM.custOrderSource.value : '';
  const orderSourceName = DOM.custOrderSourceName ? DOM.custOrderSourceName.value.trim() : '';
  const courierValue = (DOM.custCourier && DOM.custCourier.value) ? DOM.custCourier.value : 'Lalamove';
  const shippingRegion = DOM.custShippingRegion ? DOM.custShippingRegion.value : '';

  clearFieldError(DOM.custFullName, DOM.custFullNameError);
  clearFieldError(DOM.custPhone, DOM.custPhoneError);
  clearFieldError(DOM.custOrderSourceName, DOM.custOrderSourceNameError);
  clearFieldError(DOM.custShippingRegion, DOM.custShippingRegionError);
  if (DOM.receiptUploadBox) DOM.receiptUploadBox.classList.remove('has-error');
  if (DOM.receiptError) DOM.receiptError.style.display = 'none';

  let hasValidationError = false;

  if (!isValidFullName(customerName)) {
    setFieldError(DOM.custFullName, DOM.custFullNameError);
    hasValidationError = true;
  }
  if (!isValidPhPhone(customerPhone)) {
    setFieldError(DOM.custPhone, DOM.custPhoneError);
    hasValidationError = true;
  }
  if (!customerAddress) {
    showToast('Please fill out your delivery address', 'error');
    hasValidationError = true;
  }
  if (!orderSource) {
    showToast('Please select where you ordered from', 'error');
    hasValidationError = true;
  }
  if (!orderSourceName) {
    setFieldError(DOM.custOrderSourceName, DOM.custOrderSourceNameError);
    hasValidationError = true;
  }
  if (courierValue === 'J&T Express' && !shippingRegion) {
    setFieldError(DOM.custShippingRegion, DOM.custShippingRegionError);
    hasValidationError = true;
  }
  if (!posState.receiptFile) {
    if (DOM.receiptUploadBox) DOM.receiptUploadBox.classList.add('has-error');
    if (DOM.receiptError) DOM.receiptError.style.display = 'block';
    hasValidationError = true;
  }

  if (hasValidationError) return;

  const items = Object.values(posState.cart).map(it => ({
    id: it.id,
    title: it.title,
    price: it.price,
    quantity: it.qty,
    qty: it.qty,
    card_number: it.card_number !== undefined ? it.card_number : undefined,
    customization: {
      category: it.category,
      card_number: it.card_number !== undefined ? it.card_number : undefined
    }
  }));

  if (items.length === 0) {
    showToast('Please add items to your cart first', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('customer_name', customerName);
  formData.append('customer_phone', customerPhone);
  formData.append('customer_address', customerAddress);
  formData.append('order_source', orderSource);
  formData.append('order_source_name', orderSourceName);
  formData.append('courier', courierValue);
  if (courierValue === 'J&T Express') {
    formData.append('shipping_region', shippingRegion);
  }
  formData.append('payment_method', (DOM.custPayment && DOM.custPayment.value) ? DOM.custPayment.value : 'GCash');
  formData.append('items_json', JSON.stringify(items));

  formData.append('receipt', posState.receiptFile);

  try {
    DOM.submitOrderBtn.disabled = true;
    DOM.submitOrderBtn.innerText = 'Submitting Order to Admin...';

    const res = await API.submitOrder(formData);

    // Clear cart and form
    posState.cart = {};
    DOM.checkoutForm.reset();
    updateCourierUI();
    DOM.checkoutModal.classList.remove('active');
    resetReceiptPreview();
    renderDishesGrid();
    updateAllCartViews();

    // Show Success Modal
    if (DOM.successOrderId) DOM.successOrderId.innerText = res.order.id;
    if (DOM.successCustomerName) DOM.successCustomerName.innerText = res.order.customer_name;
    if (DOM.successTotal) DOM.successTotal.innerText = formatPrice(res.order.total);
    if (DOM.successCourier) DOM.successCourier.innerText = res.order.courier;
    if (DOM.successTrackLink) DOM.successTrackLink.href = `/track/${res.order.id}`;
    if (DOM.successModal) DOM.successModal.classList.add('active');

    // Reload products so live stock/card counts update
    await loadCatalogProducts();
    showToast('Order successfully sent to Admin! Your payment will be verified shortly.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
    await loadCatalogProducts();
  } finally {
    DOM.submitOrderBtn.disabled = false;
    DOM.submitOrderBtn.innerText = 'Confirm & Place Order';
  }
}

// Lightbox
// Opens the lightbox with every photo uploaded for a product (looked up by
// id, so we never need to embed a URL array inside an inline onclick).
window.openProductGallery = function(productId, startIndex = 0) {
  const prod = posState.products.find(p => String(p.id) === String(productId));
  if (!prod) return;
  const images = (prod.image_urls && prod.image_urls.length) ? prod.image_urls : [prod.image_url];
  openLightbox(images, startIndex);
};

// Opens the lightbox showing a product's full photo gallery. Accepts either
// a single image URL (backward compatible) or an array of URLs plus the
// index to start on — prev/next lets the customer browse every photo.
window.openLightbox = function(images, startIndex = 0) {
  if (!DOM.lightboxModal || !DOM.lightboxImg) return;
  posState.lightboxImages = Array.isArray(images) ? images.filter(Boolean) : [images];
  posState.lightboxIndex = Math.min(Math.max(startIndex, 0), posState.lightboxImages.length - 1);
  renderLightboxImage();
  DOM.lightboxModal.classList.add('active');
};

function renderLightboxImage() {
  const images = posState.lightboxImages;
  if (!DOM.lightboxImg || images.length === 0) return;
  DOM.lightboxImg.src = images[posState.lightboxIndex];

  const hasMultiple = images.length > 1;
  if (DOM.lightboxPrevBtn) DOM.lightboxPrevBtn.style.display = hasMultiple ? 'flex' : 'none';
  if (DOM.lightboxNextBtn) DOM.lightboxNextBtn.style.display = hasMultiple ? 'flex' : 'none';
  if (DOM.lightboxCounter) {
    DOM.lightboxCounter.style.display = hasMultiple ? 'block' : 'none';
    DOM.lightboxCounter.innerText = `${posState.lightboxIndex + 1} / ${images.length}`;
  }
}

function stepLightbox(delta) {
  const images = posState.lightboxImages;
  if (images.length === 0) return;
  posState.lightboxIndex = (posState.lightboxIndex + delta + images.length) % images.length;
  renderLightboxImage();
}

function closeLightbox() {
  if (!DOM.lightboxModal || !DOM.lightboxImg) return;
  DOM.lightboxModal.classList.remove('active');
  DOM.lightboxImg.src = '';
  posState.lightboxImages = [];
  posState.lightboxIndex = 0;
}
