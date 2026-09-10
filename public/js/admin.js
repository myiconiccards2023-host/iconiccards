/**
 * Order Now - Admin Portal Application Logic
 * Dedicated script for /admin dashboard management
 */

// Admin State
const adminState = {
  isLoggedIn: Boolean(localStorage.getItem('order_now_admin_token')),
  products: [],
  orders: [],
  lastOrdersSnapshot: '',
  productFiles: [],
  newProductPriceTiers: [],
  editState: {
    productId: null
  },
  manageCards: {
    productId: null,
    status: 'All',
    search: '',
    page: 1,
    pageSize: 50
  },
  pendingRejectOrderId: null
};

// DOM References
const DOM = {
  adminAuthBox: document.getElementById('adminAuthBox'),
  adminDashboard: document.getElementById('adminDashboard'),
  adminLoginForm: document.getElementById('adminLoginForm'),
  adminUsernameInput: document.getElementById('adminUsernameInput'),
  adminPasswordInput: document.getElementById('adminPasswordInput'),
  adminLoginBtn: document.getElementById('adminLoginBtn'),
  adminLogoutBtn: document.getElementById('adminLogoutBtn'),
  adminHeaderStoreName: document.getElementById('adminHeaderStoreName'),

  // Tabs
  adminTabOrders: document.getElementById('adminTabOrders'),
  adminTabInventory: document.getElementById('adminTabInventory'),
  adminTabAdd: document.getElementById('adminTabAdd'),
  adminTabOrdersCount: document.getElementById('adminTabOrdersCount'),
  adminTabProdCount: document.getElementById('adminTabProdCount'),

  // Sections
  adminOrdersSection: document.getElementById('adminOrdersSection'),
  adminInventorySection: document.getElementById('adminInventorySection'),
  adminAddSection: document.getElementById('adminAddSection'),

  // Orders
  ordersTableBody: document.getElementById('ordersTableBody'),
  ordersEmptyState: document.getElementById('ordersEmptyState'),
  ordersCountBadge: document.getElementById('ordersCountBadge'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  exportExcelBtn: document.getElementById('exportExcelBtn'),
  clearOrdersBtn: document.getElementById('clearOrdersBtn'),

  // Inventory
  adminProductsList: document.getElementById('adminProductsList'),
  resetBatchBtn: document.getElementById('resetBatchBtn'),

  // Add Product Form
  addProductForm: document.getElementById('addProductForm'),
  newProductTitle: document.getElementById('newProductTitle'),
  newProductDescription: document.getElementById('newProductDescription'),
  newProductCategory: document.getElementById('newProductCategory'),
  newProductPrice: document.getElementById('newProductPrice'),
  newProductPriceGroup: document.getElementById('newProductPriceGroup'),
  newProductStock: document.getElementById('newProductStock'),
  newProductStockGroup: document.getElementById('newProductStockGroup'),
  newProductIsNumbered: document.getElementById('newProductIsNumbered'),
  newProductRangeGroup: document.getElementById('newProductRangeGroup'),
  newProductStartNumber: document.getElementById('newProductStartNumber'),
  newProductEndNumber: document.getElementById('newProductEndNumber'),
  newProductPricesGroup: document.getElementById('newProductPricesGroup'),
  newProductPricesPreview: document.getElementById('newProductPricesPreview'),
  tierStartInput: document.getElementById('tierStartInput'),
  tierEndInput: document.getElementById('tierEndInput'),
  tierPriceInput: document.getElementById('tierPriceInput'),
  addTierBtn: document.getElementById('addTierBtn'),
  newProductPriceTiersList: document.getElementById('newProductPriceTiersList'),
  productPhotoUploadBox: document.getElementById('productPhotoUploadBox'),
  newProductPhoto: document.getElementById('newProductPhoto'),
  productPhotoPreview: document.getElementById('productPhotoPreview'),
  submitProductBtn: document.getElementById('submitProductBtn'),

  // Edit Product Modal
  editProductModal: document.getElementById('editProductModal'),
  editProductBackdrop: document.getElementById('editProductBackdrop'),
  closeEditProductBtn: document.getElementById('closeEditProductBtn'),
  editProductForm: document.getElementById('editProductForm'),
  editProductId: document.getElementById('editProductId'),
  editProductTitle: document.getElementById('editProductTitle'),
  editProductDescription: document.getElementById('editProductDescription'),
  editProductCategory: document.getElementById('editProductCategory'),
  editProductPrice: document.getElementById('editProductPrice'),
  editProductStock: document.getElementById('editProductStock'),
  editProductStockGroup: document.getElementById('editProductStockGroup'),
  saveEditProductBtn: document.getElementById('saveEditProductBtn'),
  editPhotoGallery: document.getElementById('editPhotoGallery'),
  editAddPhotosBtn: document.getElementById('editAddPhotosBtn'),
  editAddPhotosInput: document.getElementById('editAddPhotosInput'),

  // Card Number Settings (inside Edit Product Modal)
  cardSettingsToggleBtn: document.getElementById('cardSettingsToggleBtn'),
  cardSettingsBody: document.getElementById('cardSettingsBody'),
  cardNumberingToggle: document.getElementById('cardNumberingToggle'),
  cardRangeFields: document.getElementById('cardRangeFields'),
  cardRangeStart: document.getElementById('cardRangeStart'),
  cardRangeEnd: document.getElementById('cardRangeEnd'),
  cardSummaryTotal: document.getElementById('cardSummaryTotal'),
  cardSummaryAvailable: document.getElementById('cardSummaryAvailable'),
  cardSummaryPending: document.getElementById('cardSummaryPending'),
  cardSummarySold: document.getElementById('cardSummarySold'),
  applyCardRangeBtn: document.getElementById('applyCardRangeBtn'),
  openManageCardsBtn: document.getElementById('openManageCardsBtn'),

  // Manage Card Numbers Modal
  manageCardsModal: document.getElementById('manageCardsModal'),
  manageCardsBackdrop: document.getElementById('manageCardsBackdrop'),
  closeManageCardsBtn: document.getElementById('closeManageCardsBtn'),
  manageCardsProductTitle: document.getElementById('manageCardsProductTitle'),
  manageCardsTotal: document.getElementById('manageCardsTotal'),
  manageCardsAvailable: document.getElementById('manageCardsAvailable'),
  manageCardsPending: document.getElementById('manageCardsPending'),
  manageCardsSold: document.getElementById('manageCardsSold'),
  manageCardsSearchInput: document.getElementById('manageCardsSearchInput'),
  manageCardsFilterSelect: document.getElementById('manageCardsFilterSelect'),
  manageCardsTableBody: document.getElementById('manageCardsTableBody'),
  manageCardsPagination: document.getElementById('manageCardsPagination'),

  // Bulk Import Prices
  bulkPriceToggleBtn: document.getElementById('bulkPriceToggleBtn'),
  bulkPriceBody: document.getElementById('bulkPriceBody'),
  bulkPriceTextarea: document.getElementById('bulkPriceTextarea'),
  applyBulkPriceBtn: document.getElementById('applyBulkPriceBtn'),
  bulkPriceResult: document.getElementById('bulkPriceResult'),

  // Reject Payment Modal
  rejectPaymentModal: document.getElementById('rejectPaymentModal'),
  rejectPaymentBackdrop: document.getElementById('rejectPaymentBackdrop'),
  rejectReasonSelect: document.getElementById('rejectReasonSelect'),
  rejectReasonOther: document.getElementById('rejectReasonOther'),
  rejectPaymentCancelBtn: document.getElementById('rejectPaymentCancelBtn'),
  rejectPaymentConfirmBtn: document.getElementById('rejectPaymentConfirmBtn'),

  // Lightbox
  lightboxModal: document.getElementById('lightboxModal'),
  lightboxImg: document.getElementById('lightboxImg'),
  closeLightboxBtn: document.getElementById('closeLightboxBtn'),

  // Stats Overview
  statTotalOrders: document.getElementById('statTotalOrders'),
  statTotalRevenue: document.getElementById('statTotalRevenue'),
  statTotalProducts: document.getElementById('statTotalProducts'),
  statPendingOrders: document.getElementById('statPendingOrders'),

  toastContainer: document.getElementById('toastContainer')
};

// Utilities
const formatPrice = (amount) => {
  return '₱' + Number(amount || 0).toFixed(2);
};
const formatPHP = formatPrice; // compatibility alias

const CARD_STATUS_LABELS = {
  AVAILABLE: 'Available',
  PENDING_PAYMENT: 'Pending Payment',
  SOLD_OUT: 'Sold Out',
  DISABLED: 'Disabled'
};

// Active deleting toast tracker to avoid duplicates
let activeDeletingToast = null;

const showToast = (message, type = 'info', duration = 3500) => {
  let container = DOM.toastContainer || document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    DOM.toastContainer = container;
  }

  // Prevent duplicate deleting toasts: dismiss any existing deleting toast immediately
  if (type === 'deleting' && activeDeletingToast && activeDeletingToast.dismiss) {
    activeDeletingToast.dismiss();
    activeDeletingToast = null;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    if (activeDeletingToast === toast) {
      activeDeletingToast = null;
    }
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    setTimeout(() => {
      try { toast.remove(); } catch (e) {}
    }, 250);
  };

  toast.dismiss = dismiss;

  if (type === 'deleting') {
    activeDeletingToast = toast;
  }

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  return toast;
};

// Robust In-App Confirmation Modal Promise (never blocked by browser)
function showConfirmDialog(title, message, confirmText = 'Delete') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    const actionBtn = document.getElementById('confirmModalActionBtn');
    const backdrop = document.getElementById('confirmModalBackdrop');

    if (!modal) {
      resolve(window.confirm(`${title}\n\n${message}`));
      return;
    }

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    if (actionBtn) {
      actionBtn.innerText = confirmText;
    }

    modal.style.display = 'flex';

    let resolved = false;
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      modal.style.display = 'none';
      if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
      if (actionBtn) actionBtn.removeEventListener('click', onConfirm);
      if (backdrop) backdrop.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKeyDown);
    };

    const onCancel = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      cleanup();
      resolve(false);
    };

    const onConfirm = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      cleanup();
      resolve(true);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };

    if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
    if (actionBtn) actionBtn.addEventListener('click', onConfirm);
    if (backdrop) backdrop.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKeyDown);
  });
}

// Polling interval for live sync
let adminPollTimer = null;
function startAdminPolling() {
  if (adminPollTimer) clearInterval(adminPollTimer);
  adminPollTimer = setInterval(() => {
    if (adminState.isLoggedIn && DOM.adminDashboard && DOM.adminDashboard.style.display !== 'none') {
      loadAdminOrders(true);
    }
  }, 8000); // refresh every 8 seconds for smooth live orders
}
function stopAdminPolling() {
  if (adminPollTimer) clearInterval(adminPollTimer);
}

// Compute live dashboard stats
function updateStatsOverview() {
  const orders = adminState.orders || [];
  const products = adminState.products || [];

  if (DOM.statTotalOrders) DOM.statTotalOrders.innerText = orders.length;
  if (DOM.statTotalProducts) DOM.statTotalProducts.innerText = products.length;

  let totalRev = 0;
  let pendingCount = 0;
  orders.forEach(o => {
    if (o.status !== 'Cancelled') {
      totalRev += Number(o.total || 0);
    }
    if (o.status === 'Pending') {
      pendingCount++;
    }
  });

  if (DOM.statTotalRevenue) DOM.statTotalRevenue.innerText = formatPrice(totalRev);
  if (DOM.statPendingOrders) DOM.statPendingOrders.innerText = pendingCount;
}

// Initialize Admin Portal
async function initAdminApp() {
  setupEventListeners();

  try {
    const storeInfo = await API.getStoreInfo();
    if (storeInfo && storeInfo.storeName && DOM.adminHeaderStoreName) {
      DOM.adminHeaderStoreName.innerText = storeInfo.storeName;
    }
  } catch (err) {
    console.warn('Could not fetch store info', err);
  }

  if (adminState.isLoggedIn) {
    showDashboard();
  } else {
    showAuthGate();
  }
}

function showAuthGate() {
  stopAdminPolling();
  DOM.adminAuthBox.style.display = 'block';
  DOM.adminDashboard.style.display = 'none';
  DOM.adminLogoutBtn.style.display = 'none';
  if (DOM.adminPasswordInput) {
    DOM.adminPasswordInput.value = '';
    DOM.adminPasswordInput.focus();
  }
}

function showDashboard() {
  DOM.adminAuthBox.style.display = 'none';
  DOM.adminDashboard.style.display = 'block';
  DOM.adminLogoutBtn.style.display = 'inline-flex';
  loadAdminData();
  startAdminPolling();
}

// Switch Tabs
function switchAdminTab(tabName) {
  const sections = {
    orders: DOM.adminOrdersSection,
    inventory: DOM.adminInventorySection,
    add: DOM.adminAddSection
  };
  const tabBtns = {
    orders: DOM.adminTabOrders,
    inventory: DOM.adminTabInventory,
    add: DOM.adminTabAdd
  };

  for (const [key, section] of Object.entries(sections)) {
    if (section) section.style.display = key === tabName ? 'block' : 'none';
  }

  for (const [key, btn] of Object.entries(tabBtns)) {
    if (btn) {
      if (key === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }
}

// Load Data
async function loadAdminData() {
  await Promise.all([loadAdminProducts(), loadAdminOrders()]);
}

// Load Products
async function loadAdminProducts() {
  try {
    const products = await API.getProducts();
    adminState.products = products;
    if (DOM.adminTabProdCount) DOM.adminTabProdCount.innerText = products.length;

    DOM.adminProductsList.innerHTML = '';

    if (products.length === 0) {
      DOM.adminProductsList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
          No active products in current batch drop. Click "Add New Product" to publish items!
        </div>
      `;
      return;
    }

    products.forEach(p => {
      const item = document.createElement('div');
      item.className = 'admin-prod-item';
      item.setAttribute('data-id', p.id);
      const safeTitle = (p.title || 'Product').replace(/"/g, '&quot;');
      const numberedBadge = p.card_numbering_enabled
        ? `<span class="admin-prod-numbered-badge">#${p.card_number_start}&ndash;${p.card_number_end} &bull; ${p.card_available_count} available</span>`
        : '';
      item.innerHTML = `
        <div class="admin-prod-info">
          <img src="${p.image_url}" class="admin-prod-thumb" alt="${safeTitle}" onclick="openLightbox('${p.image_url}')">
          <div class="admin-prod-meta">
            <h4>${p.title} <span style="font-size: 0.7rem; background: #e6f9f0; color: #059669; padding: 2px 8px; border-radius: 999px; font-weight: 600; margin-left: 6px;">${p.category || 'Cards'}</span>${numberedBadge}</h4>
            <p>${formatPHP(p.price)} &bull; <strong>${p.stock} units</strong> remaining</p>
          </div>
        </div>
        <div class="admin-prod-actions">
          <button type="button" class="btn btn-outline btn-sm edit-prod-btn" data-id="${p.id}" style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span style="pointer-events: none;">Edit</span>
          </button>
          <button type="button" class="btn btn-danger btn-sm delete-prod-btn" data-id="${p.id}" data-title="${safeTitle}" style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            <span style="pointer-events: none;">Delete</span>
          </button>
        </div>
      `;
      DOM.adminProductsList.appendChild(item);
    });

    updateStatsOverview();
  } catch (err) {
    showToast('Failed to load products: ' + err.message, 'error');
  }
}

// Global Robust Handler for Deleting Products from Store & Supabase
window.handleDeleteProduct = async function(btn, id, title) {
  if (!id) return;
  if (btn && btn.dataset.isDeleting === 'true') return;

  const safeTitle = title || 'Product';

  // 1. In-App Confirmation Modal (always prompts, cannot be blocked by browser)
  const confirmed = await showConfirmDialog(
    'Delete Product',
    `Are you sure you want to delete "${safeTitle}"? This will permanently remove it from your store and Supabase database.`,
    'Delete'
  );
  if (!confirmed) return;

  if (btn) {
    btn.dataset.isDeleting = 'true';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.innerHTML = '<span class="toast-spinner" style="width: 12px; height: 12px; border-width: 1.5px; border-top-color: #ef4444;"></span><span>Deleting...</span>';
  }

  // 2. Active non-duplicated notification shown when deleting
  const delToast = showToast(`<span class="toast-spinner"></span><span>Deleting "${safeTitle}"...</span>`, 'deleting', 0);

  // 3. Optimistic dimming of product card
  const itemCard = (btn && btn.closest) ? btn.closest('.admin-prod-item') : document.querySelector(`.admin-prod-item[data-id="${id}"]`);
  if (itemCard) {
    itemCard.style.transition = 'all 0.3s ease';
    itemCard.style.opacity = '0.4';
    itemCard.style.pointerEvents = 'none';
  }

  try {
    await API.deleteProduct(id);
    if (delToast && delToast.dismiss) delToast.dismiss();
    showToast(`"${safeTitle}" deleted successfully`, 'success');

    // Immediate smooth DOM removal
    if (itemCard) {
      itemCard.style.transform = 'scale(0.92)';
      setTimeout(() => {
        try { itemCard.remove(); } catch (e) {}
      }, 250);
    }

    // Update state and stats immediately
    adminState.products = adminState.products.filter(p => String(p.id) !== String(id));
    if (DOM.adminTabProdCount) DOM.adminTabProdCount.innerText = adminState.products.length;
    updateStatsOverview();

    if (adminState.products.length === 0) {
      DOM.adminProductsList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
          No active products in current batch drop. Click "Add New Product" to publish items!
        </div>
      `;
    }
  } catch (err) {
    console.error('Delete product error:', err);
    if (delToast && delToast.dismiss) delToast.dismiss();
    showToast(err.message || 'Failed to delete product', 'error');
    if (itemCard) {
      itemCard.style.opacity = '1';
      itemCard.style.pointerEvents = 'auto';
    }
    if (btn) {
      btn.dataset.isDeleting = 'false';
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        <span style="pointer-events: none;">Delete</span>
      `;
    }
  }
};

// Load Orders
async function loadAdminOrders(isSilent = false) {
  try {
    const orders = await API.getOrders();

    // Background polling refetches every few seconds so status changes show
    // up live, but rebuilding the table when nothing actually changed is
    // what causes the flicker/blink — skip it and just leave the DOM as-is.
    const snapshot = JSON.stringify(orders);
    if (isSilent && snapshot === adminState.lastOrdersSnapshot) {
      return;
    }
    adminState.lastOrdersSnapshot = snapshot;
    adminState.orders = orders;

    if (DOM.adminTabOrdersCount) DOM.adminTabOrdersCount.innerText = orders.length;
    if (DOM.ordersCountBadge) DOM.ordersCountBadge.innerText = `${orders.length} total orders recorded`;
    updateStatsOverview();

    DOM.ordersTableBody.innerHTML = '';

    if (orders.length === 0) {
      DOM.ordersEmptyState.style.display = 'block';
      return;
    }
    DOM.ordersEmptyState.style.display = 'none';

    orders.forEach(o => {
      const tr = document.createElement('tr');
      const orderDate = new Date(o.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });

      let itemsFormatted = '';
      if (Array.isArray(o.items)) {
        itemsFormatted = o.items
          .map(it => {
            let customHtml = '';
            if (it.card_number !== undefined && it.card_number !== null) {
              customHtml = `<div style="font-size: 0.72rem; margin-top: 3px;"><span style="background: var(--bg-pill); color: var(--text-dark); font-weight: 700; padding: 1px 7px; border-radius: 4px;">Card #${it.card_number}</span></div>`;
            } else if (it.customization) {
              const c = it.customization;
              if (c.dishCourse || c.tags) {
                customHtml = `
                  <div style="font-size: 0.72rem; margin-top: 3px;">
                    ${c.dishCourse ? `<span style="background: #e6f9f0; color: #00ba70; font-weight: 600; padding: 1px 6px; border-radius: 4px;">${c.dishCourse}</span> ` : ''}
                    ${c.tags && c.tags.length ? c.tags.map(t => `<span style="background: #fee2e2; color: #ef4444; font-size: 0.68rem; padding: 1px 5px; border-radius: 3px; margin-left: 2px;">${t}</span>`).join(' ') : ''}
                  </div>
                `;
              } else {
                customHtml = `
                  <div style="font-size: 0.72rem; color: #70685e; margin-top: 2px;">
                    ${c.note || (c.paperStock ? `Stock: ${c.paperStock}` : '')}
                  </div>
                `;
              }
            }
            return `
              <div class="order-item-group">
                <div class="order-item-row">
                  <span class="order-item-title cell-truncate" title="${it.title}">${it.title}</span>
                  <span class="order-item-meta">&times;${it.quantity} &middot; ${formatPHP(it.price * it.quantity)}</span>
                </div>
                ${customHtml}
              </div>
            `;
          })
          .join('');
      } else {
        itemsFormatted = '<span style="color: var(--text-muted);">Details unavailable</span>';
      }

      let statusBadgeClass = 'status-pending';
      if (o.status === 'Paid') statusBadgeClass = 'status-paid';
      if (o.status === 'Shipped') statusBadgeClass = 'status-shipped';
      if (o.status === 'Cancelled') statusBadgeClass = 'status-cancelled';

      // Note: payment_status (AWAITING_VERIFICATION/PAID/REJECTED) isn't shown
      // separately here — it always mirrors the status badge + dropdown below,
      // so showing it too was just the same status repeated a third time.
      const rejectionLine = o.rejection_reason
        ? `<div style="font-size: 0.7rem; color: #ef4444; margin-top: 2px;">Reason: ${o.rejection_reason}</div>`
        : '';

      // Every status change an admin can make from this table is a deliberate,
      // confirmed button click — never a free-form dropdown an accidental
      // click/keypress could fire. Which buttons show depends on where the
      // order currently sits in its lifecycle.
      let workflowActionsHtml = '';
      if (o.status === 'Pending') {
        workflowActionsHtml = `
          <button type="button" class="btn btn-primary btn-sm mark-paid-btn" data-id="${o.id}">Mark as Paid</button>
          <button type="button" class="btn btn-danger btn-sm reject-payment-btn" data-id="${o.id}">Reject Payment</button>
        `;
      } else if (o.status === 'Paid') {
        workflowActionsHtml = `
          <button type="button" class="btn btn-outline btn-sm mark-shipped-btn" data-id="${o.id}">Mark as Shipped</button>
        `;
      }

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; font-family: monospace;">#${o.id}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${orderDate}</div>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.35rem;">
            <span class="status-badge ${statusBadgeClass}" id="status-badge-${o.id}">${o.status}</span>
            ${rejectionLine}
          </div>
        </td>
        <td>
          <div class="cell-truncate" style="font-weight: 600;" title="${o.customer_name}">${o.customer_name}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${o.customer_phone}</div>
          <div class="cell-truncate" style="font-size: 0.75rem; color: var(--text-muted);" title="${o.customer_address}">${o.customer_address}</div>
        </td>
        <td style="font-size: 0.82rem; line-height: 1.4;">
          ${itemsFormatted}
        </td>
        <td>
          <div style="font-weight: 600; font-size: 0.85rem;">${o.courier}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${o.payment_method}</div>
        </td>
        <td>
          <div style="font-weight: 800; font-size: 0.95rem;">${formatPHP(o.total)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">(Ship: ${formatPHP(o.shipping_fee)})</div>
        </td>
        <td>
          ${
            o.receipt_url
              ? `<img src="${o.receipt_url}" class="receipt-thumbnail" alt="Receipt" onclick="openLightbox('${o.receipt_url}')">`
              : `<span style="font-size: 0.75rem; color: var(--text-muted);">None</span>`
          }
        </td>
        <td class="order-action-cell">
          <div class="order-action-stack">
            ${workflowActionsHtml}
            <button type="button" class="btn-order-delete delete-single-order-btn" data-id="${o.id}" title="Delete order">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span style="pointer-events: none;">Delete</span>
            </button>
          </div>
        </td>
      `;

      DOM.ordersTableBody.appendChild(tr);
    });
  } catch (err) {
    showToast('Failed to load orders: ' + err.message, 'error');
  }
}

// Admin: verify payment and finalize the sale (the ONLY action that sells a numbered card)
async function handleMarkOrderPaid(orderId) {
  const confirmed = await showConfirmDialog(
    'Mark Order as Paid',
    `Confirm that payment for order #${orderId} has been verified. Any card numbers on this order will become permanently Sold Out.`,
    'Mark as Paid'
  );
  if (!confirmed) return;

  try {
    await API.markOrderPaid(orderId);
    showToast(`Order #${orderId} marked as Paid`, 'success');
    await loadAdminOrders();
    await loadAdminProducts();
  } catch (err) {
    showToast(err.message || 'Failed to mark order as paid', 'error');
    await loadAdminOrders();
  }
}

// Admin: mark an already-paid order as Shipped once it's handed to the courier
async function handleMarkOrderShipped(orderId) {
  const confirmed = await showConfirmDialog(
    'Mark Order as Shipped',
    `Confirm that order #${orderId} has been handed to the courier.`,
    'Mark as Shipped'
  );
  if (!confirmed) return;

  try {
    await API.updateOrderStatus(orderId, 'Shipped');
    showToast(`Order #${orderId} marked as Shipped`, 'success');
    await loadAdminOrders();
  } catch (err) {
    showToast(err.message || 'Failed to mark order as shipped', 'error');
    await loadAdminOrders();
  }
}

// Global Robust Handler for Deleting Single Customer Orders
window.handleDeleteSingleOrder = async function(btn, orderId) {
  if (!orderId) return;
  if (btn && btn.dataset.isDeleting === 'true') return;

  // 1. In-App Confirmation Modal (always prompts, cannot be blocked by browser)
  const confirmed = await showConfirmDialog(
    'Delete Order',
    `Are you sure you want to delete order #${orderId}? This customer order record will be permanently deleted from database.`,
    'Delete Order'
  );
  if (!confirmed) return;

  if (btn) {
    btn.dataset.isDeleting = 'true';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.innerHTML = '<span class="toast-spinner" style="width: 12px; height: 12px; border-width: 1.5px; border-top-color: #ef4444;"></span><span>Deleting...</span>';
  }

  // 2. Active non-duplicated notification shown when deleting
  const delToast = showToast(`<span class="toast-spinner"></span><span>Deleting order #${orderId}...</span>`, 'deleting', 0);

  const tr = (btn && btn.closest) ? btn.closest('tr') : null;
  if (tr) {
    tr.style.transition = 'all 0.3s ease';
    tr.style.opacity = '0.4';
    tr.style.pointerEvents = 'none';
  }

  try {
    await API.deleteOrder(orderId);
    if (delToast && delToast.dismiss) delToast.dismiss();
    showToast(`Order #${orderId} deleted successfully`, 'success');
    if (tr) tr.remove();

    adminState.orders = adminState.orders.filter(o => String(o.id) !== String(orderId));
    if (DOM.adminTabOrdersCount) DOM.adminTabOrdersCount.innerText = adminState.orders.length;
    if (DOM.ordersCountBadge) DOM.ordersCountBadge.innerText = `${adminState.orders.length} total orders recorded`;
    updateStatsOverview();

    if (adminState.orders.length === 0 && DOM.ordersEmptyState) {
      DOM.ordersEmptyState.style.display = 'block';
    }
  } catch (err) {
    console.error('Delete order error:', err);
    if (delToast && delToast.dismiss) delToast.dismiss();
    showToast(err.message || 'Failed to delete order', 'error');
    if (tr) {
      tr.style.opacity = '1';
      tr.style.pointerEvents = 'auto';
    }
    if (btn) {
      btn.dataset.isDeleting = 'false';
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span style="pointer-events: none;">Delete</span>
      `;
    }
  }
};

// ==========================================================================
// REJECT PAYMENT MODAL
// ==========================================================================

function openRejectPaymentModal(orderId) {
  adminState.pendingRejectOrderId = orderId;
  if (DOM.rejectReasonSelect) DOM.rejectReasonSelect.value = 'Payment receipt is invalid';
  if (DOM.rejectReasonOther) {
    DOM.rejectReasonOther.value = '';
    DOM.rejectReasonOther.style.display = 'none';
  }
  if (DOM.rejectPaymentModal) DOM.rejectPaymentModal.style.display = 'flex';
}

function closeRejectPaymentModal() {
  if (DOM.rejectPaymentModal) DOM.rejectPaymentModal.style.display = 'none';
  adminState.pendingRejectOrderId = null;
}

async function handleConfirmRejectPayment() {
  const orderId = adminState.pendingRejectOrderId;
  if (!orderId) return;

  const reason = DOM.rejectReasonSelect.value === 'Other'
    ? (DOM.rejectReasonOther.value.trim() || 'Other')
    : DOM.rejectReasonSelect.value;

  try {
    DOM.rejectPaymentConfirmBtn.disabled = true;
    await API.rejectOrderPayment(orderId, reason);
    showToast(`Payment for order #${orderId} rejected`, 'success');
    closeRejectPaymentModal();
    await loadAdminOrders();
    await loadAdminProducts();
  } catch (err) {
    showToast(err.message || 'Failed to reject payment', 'error');
  } finally {
    DOM.rejectPaymentConfirmBtn.disabled = false;
  }
}

// Toggle Numbered Product fields in Add Product form.
// Numbered products price entirely through the Card Prices tier builder —
// the flat Price field is only meaningful (and shown) for plain products.
function toggleNumberedProductFields() {
  const isNumbered = DOM.newProductIsNumbered && DOM.newProductIsNumbered.checked;
  if (DOM.newProductPriceGroup) DOM.newProductPriceGroup.style.display = isNumbered ? 'none' : 'block';
  if (DOM.newProductStockGroup) DOM.newProductStockGroup.style.display = isNumbered ? 'none' : 'block';
  if (DOM.newProductRangeGroup) DOM.newProductRangeGroup.style.display = isNumbered ? 'grid' : 'none';
  if (DOM.newProductPricesGroup) DOM.newProductPricesGroup.style.display = isNumbered ? 'block' : 'none';
  if (DOM.newProductPrice) DOM.newProductPrice.required = !isNumbered;
  if (DOM.newProductStock) DOM.newProductStock.required = !isNumbered;
  if (DOM.newProductStartNumber) DOM.newProductStartNumber.required = isNumbered;
  if (DOM.newProductEndNumber) DOM.newProductEndNumber.required = isNumbered;
}

// The tier builder is the single source of truth for staged {start, end, price}
// entries while adding a new numbered product.
function getStagedPriceEntries() {
  return { entries: adminState.newProductPriceTiers, skippedLines: [] };
}

// Finds any numbers within [rangeStart, rangeEnd] that no tier covers, so
// submission can be blocked before a card goes live with no price at all.
function findUncoveredNumbers(tiers, rangeStart, rangeEnd) {
  const covered = new Array(rangeEnd - rangeStart + 1).fill(false);
  tiers.forEach(t => {
    for (let n = Math.max(t.start, rangeStart); n <= Math.min(t.end, rangeEnd); n++) {
      covered[n - rangeStart] = true;
    }
  });

  const gaps = [];
  let gapStart = null;
  for (let i = 0; i < covered.length; i++) {
    const num = rangeStart + i;
    if (!covered[i]) {
      if (gapStart === null) gapStart = num;
    } else if (gapStart !== null) {
      gaps.push({ start: gapStart, end: num - 1 });
      gapStart = null;
    }
  }
  if (gapStart !== null) gaps.push({ start: gapStart, end: rangeEnd });
  return gaps;
}

function renderPriceTiersList() {
  if (!DOM.newProductPriceTiersList) return;
  DOM.newProductPriceTiersList.innerHTML = '';
  adminState.newProductPriceTiers.forEach((tier, index) => {
    const row = document.createElement('div');
    row.className = 'price-tier-row';
    const label = tier.start === tier.end ? `Card #${tier.start}` : `Cards #${tier.start}–${tier.end}`;
    row.innerHTML = `
      <span class="price-tier-row-label">${label}</span>
      <span class="price-tier-row-price">${formatPrice(tier.price)} each</span>
      <button type="button" class="price-tier-remove-btn" data-index="${index}" title="Remove">&times;</button>
    `;
    DOM.newProductPriceTiersList.appendChild(row);
  });
  updateNewProductPricesPreview();
}

function handleAddPriceTier() {
  const start = parseInt(DOM.tierStartInput.value, 10);
  const end = DOM.tierEndInput.value.trim() ? parseInt(DOM.tierEndInput.value, 10) : start;
  const price = parseFloat(DOM.tierPriceInput.value);

  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    showToast('Please enter a valid "From #" (and optionally a "To #" that is not smaller)', 'error');
    return;
  }
  if (isNaN(price) || price < 0) {
    showToast('Please enter a valid price', 'error');
    return;
  }

  const rangeStart = Number(DOM.newProductStartNumber.value) || null;
  const rangeEnd = Number(DOM.newProductEndNumber.value) || null;
  if (rangeStart && rangeEnd && (start < rangeStart || end > rangeEnd)) {
    showToast(`This falls outside your Start/End range (${rangeStart}–${rangeEnd})`, 'error');
    return;
  }

  const overlapping = adminState.newProductPriceTiers.some(t => start <= t.end && end >= t.start);
  if (overlapping) {
    showToast('This range overlaps a tier you already added', 'error');
    return;
  }

  adminState.newProductPriceTiers.push({ start, end, price });
  adminState.newProductPriceTiers.sort((a, b) => a.start - b.start);
  renderPriceTiersList();

  DOM.tierStartInput.value = '';
  DOM.tierEndInput.value = '';
  DOM.tierPriceInput.value = '';
  DOM.tierStartInput.focus();
}

function handleRemovePriceTier(index) {
  adminState.newProductPriceTiers.splice(index, 1);
  renderPriceTiersList();
}

function resetNewProductPriceStaging() {
  adminState.newProductPriceTiers = [];
  if (DOM.newProductPriceTiersList) DOM.newProductPriceTiersList.innerHTML = '';
  if (DOM.newProductPricesPreview) DOM.newProductPricesPreview.innerText = '';
}

function updateNewProductPricesPreview() {
  if (!DOM.newProductPricesPreview) return;
  const { entries, skippedLines } = getStagedPriceEntries();

  if (entries.length === 0) {
    DOM.newProductPricesPreview.innerText = '';
    return;
  }

  const start = Number(DOM.newProductStartNumber.value) || null;
  const end = Number(DOM.newProductEndNumber.value) || null;

  const outOfRange = start && end
    ? entries.filter(e => e.start < start || e.end > end)
    : [];
  const inRange = outOfRange.length > 0
    ? entries.filter(e => e.start >= start && e.end <= end)
    : entries;

  const totalCards = inRange.reduce((sum, e) => sum + (e.end - e.start + 1), 0);
  let msg = `${totalCards} card number${totalCards === 1 ? '' : 's'} priced across ${inRange.length} tier${inRange.length === 1 ? '' : 's'}.`;
  if (skippedLines.length > 0) {
    msg += ` (${skippedLines.length} line${skippedLines.length === 1 ? '' : 's'} not recognized.)`;
  }
  if (outOfRange.length > 0) {
    msg += ` (${outOfRange.length} tier${outOfRange.length === 1 ? '' : 's'} fall outside your Start/End range and will be skipped.)`;
  }

  if (start && end) {
    const gaps = findUncoveredNumbers(inRange, start, end);
    if (gaps.length > 0) {
      const gapText = gaps.map(g => g.start === g.end ? `#${g.start}` : `#${g.start}–${g.end}`).join(', ');
      msg += ` Still needs a price: ${gapText}.`;
      DOM.newProductPricesPreview.style.color = '#e11d48';
    } else {
      msg += ' All numbers in range are covered.';
      DOM.newProductPricesPreview.style.color = '#059669';
    }
  }
  DOM.newProductPricesPreview.innerText = msg;
}

// Add New Product
async function handleAddProduct(e) {
  e.preventDefault();

  if (adminState.productFiles.length === 0) {
    showToast('Please upload or paste at least one real product photo', 'error');
    return;
  }

  const isNumbered = DOM.newProductIsNumbered && DOM.newProductIsNumbered.checked;
  let start = null;
  let end = null;
  const priceEntries = isNumbered ? getStagedPriceEntries().entries : [];

  if (isNumbered) {
    start = Number(DOM.newProductStartNumber.value);
    end = Number(DOM.newProductEndNumber.value);
    if (!start || !end || end < start) {
      showToast('Please enter a valid Start Number and End Number (e.g. 1 to 499)', 'error');
      return;
    }

    // No flat fallback price exists for numbered products — every number in
    // the range must be covered by a price tier before this can go live.
    const gaps = findUncoveredNumbers(priceEntries, start, end);
    if (gaps.length > 0) {
      const gapText = gaps.map(g => g.start === g.end ? `#${g.start}` : `#${g.start}–${g.end}`).join(', ');
      showToast(`Please add a price for: ${gapText}`, 'error');
      return;
    }
  }

  const formData = new FormData();
  formData.append('title', DOM.newProductTitle.value.trim());
  if (DOM.newProductDescription) {
    formData.append('description', DOM.newProductDescription.value.trim());
  }
  if (DOM.newProductCategory) {
    formData.append('category', DOM.newProductCategory.value.trim());
  }
  // Numbered products have no flat price (every number is fully covered by a
  // tier above); the backend still stores a placeholder price column.
  formData.append('price', isNumbered ? '0' : DOM.newProductPrice.value);
  if (isNumbered) {
    formData.append('card_numbering_enabled', 'true');
    formData.append('card_number_start', DOM.newProductStartNumber.value);
    formData.append('card_number_end', DOM.newProductEndNumber.value);
  } else {
    formData.append('stock', DOM.newProductStock.value);
  }
  adminState.productFiles.forEach(file => formData.append('photos', file));

  try {
    DOM.submitProductBtn.disabled = true;
    DOM.submitProductBtn.innerHTML = 'Uploading photo & saving...';

    const { product } = await API.addProduct(formData);

    // Apply the finalized per-card prices immediately, before this product is
    // ever browsed at its default price.
    if (priceEntries.length > 0) {
      DOM.submitProductBtn.innerHTML = 'Applying card prices...';
      const priceResult = await API.bulkSetCardPrices(product.id, priceEntries);
      const totalCards = priceResult.updated.reduce((sum, r) => sum + (r.count || 1), 0);
      showToast(`Product added! Applied prices to ${totalCards} card number${totalCards === 1 ? '' : 's'}.`, 'success');
    } else {
      showToast('Product added successfully!', 'success');
    }

    DOM.addProductForm.reset();
    resetProductPhotoPreview();
    toggleNumberedProductFields();
    resetNewProductPriceStaging();
    await loadAdminProducts();
    switchAdminTab('inventory');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    DOM.submitProductBtn.disabled = false;
    DOM.submitProductBtn.innerHTML = '<span>+ Add Product to Batch</span>';
  }
}

// ==========================================================================
// EDIT PRODUCT MODAL (title, price, category, stock + Card Number Settings)
// ==========================================================================

function openEditProductModal(id) {
  const product = adminState.products.find(p => String(p.id) === String(id));
  if (!product) return;

  adminState.editState.productId = id;

  DOM.editProductId.value = id;
  DOM.editProductTitle.value = product.title || '';
  if (DOM.editProductDescription) DOM.editProductDescription.value = product.description || '';
  DOM.editProductCategory.value = product.category || 'Cards';
  DOM.editProductPrice.value = product.price;
  renderEditPhotoGallery(product);

  const isNumbered = Boolean(product.card_numbering_enabled);
  if (DOM.editProductStockGroup) DOM.editProductStockGroup.style.display = isNumbered ? 'none' : 'block';
  if (DOM.editProductStock) DOM.editProductStock.value = product.stock;

  // Card Number Settings section
  if (DOM.cardNumberingToggle) DOM.cardNumberingToggle.checked = isNumbered;
  if (DOM.cardRangeFields) DOM.cardRangeFields.style.display = isNumbered ? 'block' : 'none';
  if (DOM.cardRangeStart) DOM.cardRangeStart.value = product.card_number_start || '';
  if (DOM.cardRangeEnd) DOM.cardRangeEnd.value = product.card_number_end || '';
  renderCardSummary(product);

  // Auto-expand the section when the product is already numbered
  setCardSettingsExpanded(isNumbered);

  DOM.editProductModal.style.display = 'flex';
}

function closeEditProductModal() {
  DOM.editProductModal.style.display = 'none';
  adminState.editState = { productId: null };
}

// Product Photo Gallery (Edit Product Modal) — add/remove take effect immediately
function renderEditPhotoGallery(product) {
  if (!DOM.editPhotoGallery) return;
  DOM.editPhotoGallery.innerHTML = '';
  (product.image_urls || []).forEach((url, index) => {
    const item = document.createElement('div');
    item.className = 'photo-thumb-item';
    item.innerHTML = `
      ${index === 0 ? '<span class="photo-thumb-cover-tag">Cover</span>' : ''}
      <img src="${url}" alt="Product photo">
      <button type="button" class="photo-thumb-remove-btn edit-remove-photo-btn" data-url="${url}" title="Remove">&times;</button>
    `;
    DOM.editPhotoGallery.appendChild(item);
  });
}

async function handleAddEditPhotos(files) {
  const id = adminState.editState.productId;
  if (!id || !files || files.length === 0) return;

  files = Array.from(files);
  const tooBig = files.find(f => f.size > MAX_UPLOAD_BYTES);
  if (tooBig) {
    showToast(`"${tooBig.name}" is too large (max 4MB per photo). Please use a smaller image.`, 'error');
    files = files.filter(f => f.size <= MAX_UPLOAD_BYTES);
    if (files.length === 0) return;
  }
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_UPLOAD_BYTES) {
    showToast('These photos are too large to upload together (max 4MB total). Try adding fewer or smaller photos.', 'error');
    return;
  }

  const formData = new FormData();
  files.forEach(file => formData.append('photos', file));

  try {
    DOM.editAddPhotosBtn.disabled = true;
    DOM.editAddPhotosBtn.innerText = 'Uploading...';
    const result = await API.addProductPhotos(id, formData);
    const idx = adminState.products.findIndex(p => String(p.id) === String(id));
    if (idx !== -1) adminState.products[idx] = result.product;
    renderEditPhotoGallery(result.product);
    showToast('Photo(s) added', 'success');
    await loadAdminProducts();
  } catch (err) {
    showToast(err.message || 'Failed to add photos', 'error');
  } finally {
    DOM.editAddPhotosBtn.disabled = false;
    DOM.editAddPhotosBtn.innerText = '+ Add Photos';
  }
}

async function handleRemoveEditPhoto(url) {
  const id = adminState.editState.productId;
  if (!id) return;

  const confirmed = await showConfirmDialog(
    'Remove Photo',
    'This will remove the photo from the product\'s gallery permanently.',
    'Remove'
  );
  if (!confirmed) return;

  try {
    const result = await API.removeProductPhoto(id, url);
    const idx = adminState.products.findIndex(p => String(p.id) === String(id));
    if (idx !== -1) adminState.products[idx] = result.product;
    renderEditPhotoGallery(result.product);
    showToast('Photo removed', 'success');
    await loadAdminProducts();
  } catch (err) {
    showToast(err.message || 'Failed to remove photo', 'error');
  }
}

function renderCardSummary(product) {
  if (!product) return;
  if (DOM.cardSummaryTotal) {
    const total = (product.card_number_end || 0) - (product.card_number_start || 0) + 1;
    DOM.cardSummaryTotal.innerText = product.card_numbering_enabled ? Math.max(0, total) : 0;
  }
  if (DOM.cardSummaryAvailable) DOM.cardSummaryAvailable.innerText = product.card_available_count || 0;
  if (DOM.cardSummaryPending) DOM.cardSummaryPending.innerText = product.card_pending_count || 0;
  if (DOM.cardSummarySold) DOM.cardSummarySold.innerText = product.card_sold_count || 0;
}

function setCardSettingsExpanded(expanded) {
  if (DOM.cardSettingsBody) DOM.cardSettingsBody.style.display = expanded ? 'block' : 'none';
  if (DOM.cardSettingsToggleBtn) DOM.cardSettingsToggleBtn.classList.toggle('expanded', expanded);
}

function toggleCardSettingsSection() {
  const isExpanded = DOM.cardSettingsBody && DOM.cardSettingsBody.style.display !== 'none';
  setCardSettingsExpanded(!isExpanded);
}

function handleCardNumberingToggleChange() {
  const checked = DOM.cardNumberingToggle.checked;
  if (DOM.cardRangeFields) DOM.cardRangeFields.style.display = checked ? 'block' : 'none';
}

async function handleApplyCardRange() {
  const id = adminState.editState.productId;
  if (!id) return;

  const checked = DOM.cardNumberingToggle.checked;
  const payload = checked
    ? {
        card_numbering_enabled: true,
        card_number_start: DOM.cardRangeStart.value,
        card_number_end: DOM.cardRangeEnd.value
      }
    : { card_numbering_enabled: false };

  if (checked && (!DOM.cardRangeStart.value || !DOM.cardRangeEnd.value)) {
    showToast('Please enter both a Start Number and End Number', 'error');
    return;
  }

  try {
    DOM.applyCardRangeBtn.disabled = true;
    DOM.applyCardRangeBtn.innerText = 'Saving...';
    const result = await API.updateCardRange(id, payload);

    // Keep local cache in sync so the modal + inventory list reflect the change immediately
    const idx = adminState.products.findIndex(p => String(p.id) === String(id));
    if (idx !== -1) adminState.products[idx] = result.product;

    renderCardSummary(result.product);
    if (DOM.editProductStockGroup) DOM.editProductStockGroup.style.display = result.product.card_numbering_enabled ? 'none' : 'block';
    if (DOM.editProductStock) DOM.editProductStock.value = result.product.stock;

    showToast('Card number settings saved', 'success');
    await loadAdminProducts();
  } catch (err) {
    showToast(err.message || 'Failed to update card number settings', 'error');
  } finally {
    DOM.applyCardRangeBtn.disabled = false;
    DOM.applyCardRangeBtn.innerText = 'Save Card Number Settings';
  }
}

async function handleEditProductSubmit(e) {
  e.preventDefault();
  const id = adminState.editState.productId;
  if (!id) return;

  const formData = new FormData();
  formData.append('title', DOM.editProductTitle.value.trim());
  if (DOM.editProductDescription) {
    formData.append('description', DOM.editProductDescription.value.trim());
  }
  formData.append('category', DOM.editProductCategory.value.trim());
  formData.append('price', DOM.editProductPrice.value);

  const product = adminState.products.find(p => String(p.id) === String(id));
  if (!product || !product.card_numbering_enabled) {
    formData.append('stock', DOM.editProductStock.value);
  }

  try {
    DOM.saveEditProductBtn.disabled = true;
    DOM.saveEditProductBtn.innerHTML = '<span>Saving...</span>';

    await API.updateProduct(id, formData);
    showToast('Product updated successfully!', 'success');
    closeEditProductModal();
    await loadAdminProducts();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    DOM.saveEditProductBtn.disabled = false;
    DOM.saveEditProductBtn.innerHTML = '<span>Save Changes</span>';
  }
}

// ==========================================================================
// MANAGE CARD NUMBERS MODAL (search, filter, paginated table, mark actions)
// ==========================================================================

function openManageCardsModal() {
  const id = adminState.editState.productId;
  const product = adminState.products.find(p => String(p.id) === String(id));
  if (!product) return;

  adminState.manageCards = { productId: id, status: 'All', search: '', page: 1, pageSize: 50 };
  if (DOM.manageCardsProductTitle) DOM.manageCardsProductTitle.innerText = product.title;
  if (DOM.manageCardsSearchInput) DOM.manageCardsSearchInput.value = '';
  if (DOM.manageCardsFilterSelect) DOM.manageCardsFilterSelect.value = 'All';
  if (DOM.bulkPriceTextarea) DOM.bulkPriceTextarea.value = '';
  if (DOM.bulkPriceResult) DOM.bulkPriceResult.innerText = '';
  if (DOM.bulkPriceBody) DOM.bulkPriceBody.style.display = 'none';
  if (DOM.bulkPriceToggleBtn) DOM.bulkPriceToggleBtn.classList.remove('expanded');

  if (DOM.manageCardsModal) DOM.manageCardsModal.style.display = 'flex';
  loadManageCardsPage();
}

function closeManageCardsModal() {
  if (DOM.manageCardsModal) DOM.manageCardsModal.style.display = 'none';
}

async function loadManageCardsPage() {
  const { productId, status, search, page, pageSize } = adminState.manageCards;
  if (!productId) return;

  try {
    const result = await API.listAdminCards(productId, { status, search, page, pageSize });
    renderManageCardsTable(result.cards);
    renderManageCardsPagination(result.total, result.page, result.pageSize);

    const product = adminState.products.find(p => String(p.id) === String(productId));
    if (product) {
      if (DOM.manageCardsTotal) DOM.manageCardsTotal.innerText = (product.card_number_end - product.card_number_start + 1);
      if (DOM.manageCardsAvailable) DOM.manageCardsAvailable.innerText = product.card_available_count || 0;
      if (DOM.manageCardsPending) DOM.manageCardsPending.innerText = product.card_pending_count || 0;
      if (DOM.manageCardsSold) DOM.manageCardsSold.innerText = product.card_sold_count || 0;
    }
  } catch (err) {
    showToast(err.message || 'Failed to load card numbers', 'error');
  }
}

function renderManageCardsTable(cards) {
  if (!DOM.manageCardsTableBody) return;
  DOM.manageCardsTableBody.innerHTML = '';

  if (!cards || cards.length === 0) {
    DOM.manageCardsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No card numbers match this search/filter.</td></tr>`;
    return;
  }

  const product = adminState.products.find(p => String(p.id) === String(adminState.manageCards.productId));
  const basePrice = product ? Number(product.price) : 0;

  cards.forEach(card => {
    const tr = document.createElement('tr');
    const badge = `<span class="card-status-badge card-status-${card.status}">${CARD_STATUS_LABELS[card.status] || card.status}</span>`;

    let orderCell = '<span style="color: var(--text-muted); font-size: 0.78rem;">&mdash;</span>';
    if (card.status === 'PENDING_PAYMENT' && card.pending_order_id) {
      orderCell = `<span style="font-family: monospace; font-size: 0.75rem;">#${card.pending_order_id}</span>`;
    } else if (card.status === 'SOLD_OUT' && card.sold_order_id) {
      orderCell = `<span style="font-family: monospace; font-size: 0.75rem;">#${card.sold_order_id}</span>`;
    } else if (card.status === 'SOLD_OUT') {
      orderCell = `<span style="color: var(--text-muted); font-size: 0.75rem;">Sold manually</span>`;
    }

    let actionsHtml = '<span style="color: var(--text-muted); font-size: 0.75rem;">Manage in Orders tab</span>';
    if (card.status === 'AVAILABLE') {
      actionsHtml = `
        <button type="button" class="btn btn-danger btn-sm mark-card-btn" data-number="${card.card_number}" data-status="SOLD_OUT" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;">Mark Sold Out</button>
        <button type="button" class="btn btn-outline btn-sm mark-card-btn" data-number="${card.card_number}" data-status="DISABLED" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;">Disable</button>
      `;
    } else if (card.status === 'SOLD_OUT' || card.status === 'DISABLED') {
      actionsHtml = `<button type="button" class="btn btn-primary btn-sm mark-card-btn" data-number="${card.card_number}" data-status="AVAILABLE" style="font-size: 0.72rem; padding: 0.25rem 0.55rem;">Mark Available</button>`;
    }

    const hasCustomPrice = card.price !== null && card.price !== undefined;
    const effectivePrice = hasCustomPrice ? Number(card.price) : basePrice;
    const priceCell = `
      <div class="manage-cards-price-cell">
        <input type="number" step="0.01" min="0" class="manage-cards-price-input card-price-input" data-number="${card.card_number}" value="${effectivePrice}">
        <button type="button" class="manage-cards-price-save-btn save-card-price-btn" data-number="${card.card_number}">Save</button>
      </div>
      ${hasCustomPrice ? '<div class="manage-cards-price-custom-tag">Custom</div>' : ''}
    `;

    tr.innerHTML = `
      <td style="font-weight: 700;">#${card.card_number}</td>
      <td>${badge}</td>
      <td>${priceCell}</td>
      <td>${orderCell}</td>
      <td style="display: flex; gap: 0.35rem; flex-wrap: wrap;">${actionsHtml}</td>
    `;
    DOM.manageCardsTableBody.appendChild(tr);
  });
}

function renderManageCardsPagination(total, page, pageSize) {
  if (!DOM.manageCardsPagination) return;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(total, page * pageSize);

  let html = `<div class="manage-cards-pagination-info">Showing ${startItem}&ndash;${endItem} of ${total}</div>`;
  html += `<button type="button" class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>`;

  const maxButtons = 7;
  let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  startPage = Math.max(1, endPage - maxButtons + 1);

  for (let p = startPage; p <= endPage; p++) {
    html += `<button type="button" class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`;
  }

  html += `<button type="button" class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next</button>`;
  DOM.manageCardsPagination.innerHTML = html;
}

async function handleMarkCardStatus(cardNumber, newStatus) {
  const productId = adminState.manageCards.productId;
  if (!productId) return;

  const actionLabel = newStatus === 'AVAILABLE' ? 'Make Available' : (newStatus === 'DISABLED' ? 'Disable' : 'Mark Sold Out');
  const confirmed = await showConfirmDialog(
    `${actionLabel} Card #${cardNumber}?`,
    newStatus === 'AVAILABLE'
      ? `Card #${cardNumber} will become available for customers to select again.`
      : `Card #${cardNumber} will no longer be selectable by customers.`,
    actionLabel
  );
  if (!confirmed) return;

  try {
    await API.setCardStatus(productId, cardNumber, newStatus);
    showToast(`Card #${cardNumber} updated`, 'success');
    await loadAdminProducts();
    await loadManageCardsPage();
  } catch (err) {
    showToast(err.message || 'Failed to update card', 'error');
  }
}

// Save a single card's custom price (inline edit in the Manage Card Numbers table)
async function handleSaveCardPrice(cardNumber, priceValue) {
  const productId = adminState.manageCards.productId;
  if (!productId) return;

  const price = parseFloat(priceValue);
  if (isNaN(price) || price < 0) {
    showToast('Please enter a valid price', 'error');
    return;
  }

  try {
    await API.bulkSetCardPrices(productId, [{ card_number: cardNumber, price }]);
    showToast(`Price for card #${cardNumber} saved`, 'success');
    await loadManageCardsPage();
  } catch (err) {
    showToast(err.message || 'Failed to save price', 'error');
  }
}

// Parse a pasted price list into {card_number, price} entries.
// Accepts lines like "001/499 — ₱1,500 ❌", "7 - 850", "12: $400", etc.
// Any line without a recognizable "<number> ... <price>" shape is skipped.
// Parse one line into a {start, end, price} range (start === end for a single card).
// The price is always taken as the LAST currency-marked amount in the line (or the
// last bare number if none is currency-marked) — this stays correct even when the
// card-number portion has its own annotation, e.g. "001/499 — First Printed  ₱1,500".
// The card number(s) come from the START of the line: either one number ("021/499")
// or a range ("006/499 – 010/499"); a trailing "/499" range-total is ignored.
function parseCardPriceLine(rawLine) {
  const line = rawLine.trim();
  if (!line) return null;

  const currencyMatches = [...line.matchAll(/[₱$]\s*([\d][\d,]*(?:\.\d+)?)/g)];
  let priceStr;
  if (currencyMatches.length > 0) {
    priceStr = currencyMatches[currencyMatches.length - 1][1];
  } else {
    const bareNumbers = [...line.matchAll(/([\d][\d,]*(?:\.\d+)?)/g)];
    if (bareNumbers.length === 0) return null;
    priceStr = bareNumbers[bareNumbers.length - 1][1];
  }
  const price = parseFloat(priceStr.replace(/,/g, ''));
  if (isNaN(price)) return null;

  const numberSection = line.match(/^(\d+)\s*\/?\s*\d*\s*(?:[—–\-]\s*(\d+)\s*\/?\s*\d*)?/);
  if (!numberSection) return null;
  const start = parseInt(numberSection[1], 10);
  const end = numberSection[2] ? parseInt(numberSection[2], 10) : start;
  if (isNaN(start) || isNaN(end) || end < start) return null;

  return { start, end, price };
}

function parseCardPriceList(text) {
  const entries = [];
  const skippedLines = [];

  text.split('\n').forEach(line => {
    if (!line.trim()) return;
    const parsed = parseCardPriceLine(line);
    if (!parsed) {
      skippedLines.push(line.trim());
      return;
    }
    entries.push(parsed);
  });

  return { entries, skippedLines };
}

async function handleApplyBulkPrices() {
  const productId = adminState.manageCards.productId;
  if (!productId || !DOM.bulkPriceTextarea) return;

  const { entries, skippedLines } = parseCardPriceList(DOM.bulkPriceTextarea.value);
  if (entries.length === 0) {
    showToast('No valid "card number — price" lines found to import', 'error');
    return;
  }

  try {
    DOM.applyBulkPriceBtn.disabled = true;
    DOM.applyBulkPriceBtn.innerText = 'Applying...';

    const result = await API.bulkSetCardPrices(productId, entries);
    const totalCards = result.updated.reduce((sum, r) => sum + (r.count || 1), 0);
    const summary = `Applied prices to ${totalCards} card number${totalCards === 1 ? '' : 's'} across ${result.updated.length} price tier${result.updated.length === 1 ? '' : 's'}` +
      (result.skipped.length ? `, skipped ${result.skipped.length} invalid entr${result.skipped.length === 1 ? 'y' : 'ies'}` : '') +
      (skippedLines.length ? `, ${skippedLines.length} line${skippedLines.length === 1 ? '' : 's'} not recognized` : '');

    if (DOM.bulkPriceResult) DOM.bulkPriceResult.innerText = summary;
    showToast(summary, 'success');
    await loadManageCardsPage();
  } catch (err) {
    showToast(err.message || 'Failed to apply bulk prices', 'error');
  } finally {
    DOM.applyBulkPriceBtn.disabled = false;
    DOM.applyBulkPriceBtn.innerText = 'Apply Prices';
  }
}

// Reset Batch
async function handleBatchReset() {
  const confirmed = await showConfirmDialog(
    'Reset for New Batch',
    'This will delete ALL active products currently in the catalog to prepare for your next drop.\n\nYour customer orders, receipts, and order histories are safely preserved.',
    'Reset Batch'
  );

  if (!confirmed) return;

  const delToast = showToast(`<span class="toast-spinner"></span><span>Deleting all catalog items for new batch...</span>`, 'deleting', 0);

  try {
    DOM.resetBatchBtn.disabled = true;
    await API.resetBatch();
    if (delToast && delToast.dismiss) delToast.dismiss();
    showToast('Batch reset! Catalog is clear for new drop.', 'success');
    await loadAdminProducts();
  } catch (err) {
    if (delToast && delToast.dismiss) delToast.dismiss();
    showToast(err.message, 'error');
  } finally {
    DOM.resetBatchBtn.disabled = false;
  }
}

// Export CSV
function handleExportCsv() {
  const exportUrl = API.getExportCsvUrl();
  window.open(exportUrl, '_blank');
}

function handleExportExcel() {
  const exportUrl = API.getExportExcelUrl();
  window.open(exportUrl, '_blank');
}

// Clear all customer transactions
async function handleClearCustomerTransactions() {
  const count = adminState.orders ? adminState.orders.length : 0;
  if (count === 0) {
    showToast('No customer transactions to clear', 'info');
    return;
  }

  const confirmed = await showConfirmDialog(
    'Clear Customer Transactions',
    `This will permanently delete all ${count} customer orders from the system database.\n\nYour products and catalog items will NOT be deleted.`,
    'Clear Orders'
  );

  if (!confirmed) return;

  const delToast = showToast(`<span class="toast-spinner"></span><span>Deleting all ${count} customer transactions...</span>`, 'deleting', 0);

  try {
    if (DOM.clearOrdersBtn) {
      DOM.clearOrdersBtn.disabled = true;
      DOM.clearOrdersBtn.innerText = 'Clearing...';
    }

    await API.clearAllOrders();
    if (delToast && delToast.dismiss) delToast.dismiss();
    showToast('All customer transactions cleared successfully!', 'success');
    await loadAdminOrders();
  } catch (err) {
    if (delToast && delToast.dismiss) delToast.dismiss();
    showToast(err.message, 'error');
  } finally {
    if (DOM.clearOrdersBtn) {
      DOM.clearOrdersBtn.disabled = false;
      DOM.clearOrdersBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
        <span>Clear Transactions</span>
      `;
    }
  }
}

// Photo Preview Helpers (multi-photo staging for the Add Product form)
// Vercel serverless functions hard-cap request bodies around ~4.5MB — stay
// safely under that so uploads fail with a clear message here instead of a
// cryptic 413 from the platform after the request is already sent.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function addProductPhotoFiles(files) {
  const tooBig = files.find(f => f.size > MAX_UPLOAD_BYTES);
  if (tooBig) {
    showToast(`"${tooBig.name}" is too large (max 4MB per photo). Please use a smaller image.`, 'error');
    files = files.filter(f => f.size <= MAX_UPLOAD_BYTES);
    if (files.length === 0) return;
  }

  const currentTotal = adminState.productFiles.reduce((sum, f) => sum + f.size, 0);
  const newTotal = files.reduce((sum, f) => sum + f.size, 0);
  if (currentTotal + newTotal > MAX_UPLOAD_BYTES) {
    showToast('These photos are too large to upload together (max 4MB total). Try adding fewer or smaller photos.', 'error');
    return;
  }

  for (const file of files) {
    adminState.productFiles.push(file);
  }
  renderProductPhotoPreview();
}

function removeStagedProductPhoto(index) {
  adminState.productFiles.splice(index, 1);
  renderProductPhotoPreview();
}

function renderProductPhotoPreview() {
  if (!DOM.productPhotoPreview) return;
  DOM.productPhotoPreview.innerHTML = '';
  adminState.productFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'photo-thumb-item';
    item.innerHTML = `
      ${index === 0 ? '<span class="photo-thumb-cover-tag">Cover</span>' : ''}
      <img src="${URL.createObjectURL(file)}" alt="${file.name || 'Photo'}">
      <button type="button" class="photo-thumb-remove-btn" data-index="${index}" title="Remove">&times;</button>
    `;
    DOM.productPhotoPreview.appendChild(item);
  });
}

function resetProductPhotoPreview() {
  adminState.productFiles = [];
  if (DOM.newProductPhoto) DOM.newProductPhoto.value = '';
  renderProductPhotoPreview();
}

// Lightbox
function openLightbox(imageUrl) {
  DOM.lightboxImg.src = imageUrl;
  DOM.lightboxModal.classList.add('active');
}

function closeLightbox() {
  DOM.lightboxModal.classList.remove('active');
  DOM.lightboxImg.src = '';
}

// Setup Event Listeners
function setupEventListeners() {
  // Login
  DOM.adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = DOM.adminUsernameInput ? DOM.adminUsernameInput.value.trim() : 'Main Admin';
    const password = DOM.adminPasswordInput.value.trim();
    try {
      DOM.adminLoginBtn.disabled = true;
      DOM.adminLoginBtn.innerText = 'Verifying...';
      const loginRes = await API.adminLogin(username, password);
      adminState.isLoggedIn = true;
      showToast(`Logged into Admin (${loginRes.account || username})`, 'success');
      showDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      DOM.adminLoginBtn.disabled = false;
      DOM.adminLoginBtn.innerText = 'Unlock Dashboard';
    }
  });

  // Logout
  DOM.adminLogoutBtn.addEventListener('click', () => {
    API.setAdminToken('');
    adminState.isLoggedIn = false;
    showToast('Logged out of Admin');
    showAuthGate();
  });

  // Tabs
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchAdminTab(tab);
    });
  });

  // Add Product Form
  DOM.addProductForm.addEventListener('submit', handleAddProduct);

  // Batch Reset
  DOM.resetBatchBtn.addEventListener('click', handleBatchReset);

  // CSV Export
  DOM.exportCsvBtn.addEventListener('click', handleExportCsv);
  if (DOM.exportExcelBtn) DOM.exportExcelBtn.addEventListener('click', handleExportExcel);

  // Clear All Orders
  if (DOM.clearOrdersBtn) {
    DOM.clearOrdersBtn.addEventListener('click', handleClearCustomerTransactions);
  }

  // Photo Upload Pick (multiple files supported)
  DOM.productPhotoUploadBox.addEventListener('click', () => DOM.newProductPhoto.click());
  DOM.newProductPhoto.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addProductPhotoFiles(Array.from(e.target.files));
      DOM.newProductPhoto.value = '';
    }
  });
  if (DOM.productPhotoPreview) {
    DOM.productPhotoPreview.addEventListener('click', (e) => {
      const btn = e.target.closest('.photo-thumb-remove-btn');
      if (btn) removeStagedProductPhoto(parseInt(btn.getAttribute('data-index'), 10));
    });
  }

  // Paste Photo (Global & Box)
  window.addEventListener('paste', (e) => {
    if (!adminState.isLoggedIn) return;
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea') return;

    const clipboardItems = e.clipboardData ? e.clipboardData.items : [];
    for (const item of clipboardItems) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const ext = blob.type.split('/')[1] || 'png';
          const pastedFile = new File([blob], `pasted-photo-${Date.now()}.${ext}`, { type: blob.type });
          switchAdminTab('add');
          addProductPhotoFiles([pastedFile]);
          showToast('Photo pasted from clipboard! Ready to save.', 'success');
          break;
        }
      }
    }
  });

  DOM.productPhotoUploadBox.addEventListener('paste', (e) => {
    const clipboardItems = e.clipboardData ? e.clipboardData.items : [];
    for (const item of clipboardItems) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        e.stopPropagation();
        const blob = item.getAsFile();
        if (blob) {
          const ext = blob.type.split('/')[1] || 'png';
          const pastedFile = new File([blob], `pasted-photo-${Date.now()}.${ext}`, { type: blob.type });
          addProductPhotoFiles([pastedFile]);
          showToast('Photo pasted from clipboard! Ready to save.', 'success');
          break;
        }
      }
    }
  });

  // Lightbox
  DOM.closeLightboxBtn.addEventListener('click', closeLightbox);
  DOM.lightboxModal.addEventListener('click', (e) => {
    if (e.target === DOM.lightboxModal) closeLightbox();
  });

  // Delegated click handler for product card delete/edit buttons
  if (DOM.adminProductsList) {
    DOM.adminProductsList.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.delete-prod-btn');
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = deleteBtn.getAttribute('data-id');
        const title = deleteBtn.getAttribute('data-title') || 'Product';
        window.handleDeleteProduct(deleteBtn, id, title);
        return;
      }

      const editBtn = e.target.closest('.edit-prod-btn');
      if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        openEditProductModal(editBtn.getAttribute('data-id'));
      }
    });
  }

  // Numbered Product toggle in Add Product form
  if (DOM.newProductIsNumbered) {
    DOM.newProductIsNumbered.addEventListener('change', toggleNumberedProductFields);
  }
  if (DOM.newProductStartNumber) {
    DOM.newProductStartNumber.addEventListener('input', updateNewProductPricesPreview);
  }
  if (DOM.newProductEndNumber) {
    DOM.newProductEndNumber.addEventListener('input', updateNewProductPricesPreview);
  }
  if (DOM.addTierBtn) {
    DOM.addTierBtn.addEventListener('click', handleAddPriceTier);
  }
  if (DOM.tierPriceInput) {
    DOM.tierPriceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleAddPriceTier(); }
    });
  }
  if (DOM.newProductPriceTiersList) {
    DOM.newProductPriceTiersList.addEventListener('click', (e) => {
      const btn = e.target.closest('.price-tier-remove-btn');
      if (btn) handleRemovePriceTier(parseInt(btn.getAttribute('data-index'), 10));
    });
  }

  // Edit Product Modal
  if (DOM.closeEditProductBtn) {
    DOM.closeEditProductBtn.addEventListener('click', closeEditProductModal);
  }
  if (DOM.editProductBackdrop) {
    DOM.editProductBackdrop.addEventListener('click', closeEditProductModal);
  }
  if (DOM.editProductForm) {
    DOM.editProductForm.addEventListener('submit', handleEditProductSubmit);
  }
  if (DOM.editAddPhotosBtn && DOM.editAddPhotosInput) {
    DOM.editAddPhotosBtn.addEventListener('click', () => DOM.editAddPhotosInput.click());
    DOM.editAddPhotosInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleAddEditPhotos(e.target.files);
        DOM.editAddPhotosInput.value = '';
      }
    });
  }
  if (DOM.editPhotoGallery) {
    DOM.editPhotoGallery.addEventListener('click', (e) => {
      const btn = e.target.closest('.edit-remove-photo-btn');
      if (btn) handleRemoveEditPhoto(btn.getAttribute('data-url'));
    });
  }

  // Card Number Settings (collapsible section inside Edit Product Modal)
  if (DOM.cardSettingsToggleBtn) {
    DOM.cardSettingsToggleBtn.addEventListener('click', toggleCardSettingsSection);
  }
  if (DOM.cardNumberingToggle) {
    DOM.cardNumberingToggle.addEventListener('change', handleCardNumberingToggleChange);
  }
  if (DOM.applyCardRangeBtn) {
    DOM.applyCardRangeBtn.addEventListener('click', handleApplyCardRange);
  }
  if (DOM.openManageCardsBtn) {
    DOM.openManageCardsBtn.addEventListener('click', openManageCardsModal);
  }

  // Manage Card Numbers Modal
  if (DOM.closeManageCardsBtn) {
    DOM.closeManageCardsBtn.addEventListener('click', closeManageCardsModal);
  }
  if (DOM.manageCardsBackdrop) {
    DOM.manageCardsBackdrop.addEventListener('click', closeManageCardsModal);
  }
  if (DOM.manageCardsSearchInput) {
    DOM.manageCardsSearchInput.addEventListener('change', () => {
      adminState.manageCards.search = DOM.manageCardsSearchInput.value.trim();
      adminState.manageCards.page = 1;
      loadManageCardsPage();
    });
    DOM.manageCardsSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        adminState.manageCards.search = DOM.manageCardsSearchInput.value.trim();
        adminState.manageCards.page = 1;
        loadManageCardsPage();
      }
    });
  }
  if (DOM.manageCardsFilterSelect) {
    DOM.manageCardsFilterSelect.addEventListener('change', () => {
      adminState.manageCards.status = DOM.manageCardsFilterSelect.value;
      adminState.manageCards.page = 1;
      loadManageCardsPage();
    });
  }
  if (DOM.manageCardsTableBody) {
    DOM.manageCardsTableBody.addEventListener('click', (e) => {
      const markBtn = e.target.closest('.mark-card-btn');
      if (markBtn) {
        const cardNumber = parseInt(markBtn.getAttribute('data-number'), 10);
        const status = markBtn.getAttribute('data-status');
        handleMarkCardStatus(cardNumber, status);
        return;
      }

      const saveBtn = e.target.closest('.save-card-price-btn');
      if (saveBtn) {
        const cardNumber = parseInt(saveBtn.getAttribute('data-number'), 10);
        const input = saveBtn.closest('.manage-cards-price-cell').querySelector('.card-price-input');
        handleSaveCardPrice(cardNumber, input.value);
      }
    });
  }

  // Bulk Import Prices toggle + apply
  if (DOM.bulkPriceToggleBtn) {
    DOM.bulkPriceToggleBtn.addEventListener('click', () => {
      const isExpanded = DOM.bulkPriceBody && DOM.bulkPriceBody.style.display !== 'none';
      if (DOM.bulkPriceBody) DOM.bulkPriceBody.style.display = isExpanded ? 'none' : 'block';
      DOM.bulkPriceToggleBtn.classList.toggle('expanded', !isExpanded);
    });
  }
  if (DOM.applyBulkPriceBtn) {
    DOM.applyBulkPriceBtn.addEventListener('click', handleApplyBulkPrices);
  }
  if (DOM.manageCardsPagination) {
    DOM.manageCardsPagination.addEventListener('click', (e) => {
      const btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      const page = parseInt(btn.getAttribute('data-page'), 10);
      if (isNaN(page) || page < 1) return;
      adminState.manageCards.page = page;
      loadManageCardsPage();
    });
  }

  // Reject Payment Modal
  if (DOM.rejectReasonSelect) {
    DOM.rejectReasonSelect.addEventListener('change', () => {
      DOM.rejectReasonOther.style.display = DOM.rejectReasonSelect.value === 'Other' ? 'block' : 'none';
    });
  }
  if (DOM.rejectPaymentCancelBtn) {
    DOM.rejectPaymentCancelBtn.addEventListener('click', closeRejectPaymentModal);
  }
  if (DOM.rejectPaymentBackdrop) {
    DOM.rejectPaymentBackdrop.addEventListener('click', closeRejectPaymentModal);
  }
  if (DOM.rejectPaymentConfirmBtn) {
    DOM.rejectPaymentConfirmBtn.addEventListener('click', handleConfirmRejectPayment);
  }

  // Delegated click handler for order action buttons (delete / mark paid / reject payment)
  if (DOM.ordersTableBody) {
    DOM.ordersTableBody.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.delete-single-order-btn');
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = deleteBtn.getAttribute('data-id');
        window.handleDeleteSingleOrder(deleteBtn, id);
        return;
      }

      const markPaidBtn = e.target.closest('.mark-paid-btn');
      if (markPaidBtn) {
        e.preventDefault();
        e.stopPropagation();
        handleMarkOrderPaid(markPaidBtn.getAttribute('data-id'));
        return;
      }

      const rejectBtn = e.target.closest('.reject-payment-btn');
      if (rejectBtn) {
        e.preventDefault();
        e.stopPropagation();
        openRejectPaymentModal(rejectBtn.getAttribute('data-id'));
        return;
      }

      const markShippedBtn = e.target.closest('.mark-shipped-btn');
      if (markShippedBtn) {
        e.preventDefault();
        e.stopPropagation();
        handleMarkOrderShipped(markShippedBtn.getAttribute('data-id'));
      }
    });
  }
}

// Expose lightbox globally for inline onclick
window.openLightbox = openLightbox;

document.addEventListener('DOMContentLoaded', initAdminApp);
