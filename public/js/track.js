(function () {
  // Three customer-facing steps. "Processed" isn't a real backend status —
  // once an order is marked Paid, the page waits PROCESSED_DELAY_MS and then
  // advances to Processed on its own, based on elapsed time since paid_at so
  // it lands in the right place even on a fresh page load, not just live.
  const STEPS = [
    { key: 'Pending', label: 'Payment Verification' },
    { key: 'Paid', label: 'Paid' },
    { key: 'Processed', label: 'Processed' }
  ];

  const PROCESSED_DELAY_MS = 3000;
  const POLL_INTERVAL_MS = 15000;
  const TERMINAL_STATUSES = ['Paid', 'Shipped', 'Cancelled'];

  const DOM = {
    loading: document.getElementById('trackLoading'),
    error: document.getElementById('trackError'),
    errorMsg: document.getElementById('trackErrorMsg'),
    content: document.getElementById('trackContent'),
    orderId: document.getElementById('trackOrderId'),
    refreshBtn: document.getElementById('trackRefreshBtn'),
    stepper: document.getElementById('trackStepper'),
    cancelledBox: document.getElementById('trackCancelledBox'),
    cancelledReason: document.getElementById('trackCancelledReason'),
    itemsList: document.getElementById('trackItemsList'),
    subtotal: document.getElementById('trackSubtotal'),
    shipping: document.getElementById('trackShipping'),
    total: document.getElementById('trackTotal'),
    customer: document.getElementById('trackCustomer'),
    courier: document.getElementById('trackCourier'),
    payment: document.getElementById('trackPayment'),
    placedAt: document.getElementById('trackPlacedAt')
  };

  let pollTimer = null;
  let processedTimer = null;

  function getOrderIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/track\/([^/?#]+)/);
    if (match) return decodeURIComponent(match[1]);
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  function formatPrice(amount) {
    return '₱' + Number(amount || 0).toFixed(2);
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function showState(state) {
    DOM.loading.style.display = state === 'loading' ? '' : 'none';
    DOM.error.style.display = state === 'error' ? '' : 'none';
    DOM.content.style.display = state === 'content' ? '' : 'none';
  }

  // A status of Paid/Shipped is "processed" once PROCESSED_DELAY_MS has passed
  // since paid_at — computed from the timestamp so it's correct immediately on
  // load, not just for a page that was open when the timer fired.
  function isProcessed(order) {
    if (order.status === 'Shipped') return true;
    if (order.status !== 'Paid') return false;
    if (!order.paid_at) return true;
    return (Date.now() - new Date(order.paid_at).getTime()) >= PROCESSED_DELAY_MS;
  }

  function renderStepper(order) {
    DOM.stepper.innerHTML = '';

    if (order.status === 'Cancelled') {
      DOM.cancelledBox.style.display = '';
      return;
    }

    DOM.cancelledBox.style.display = 'none';

    const processed = isProcessed(order);
    // Index of the step currently "in progress" (glowing ring). Once processed,
    // there's nothing left in progress, so point past the last step — every
    // step before it then counts as done and none is "current".
    const currentIndex = processed ? STEPS.length : (order.status === 'Paid' ? 1 : 0);

    STEPS.forEach((step, i) => {
      const isDone = i < currentIndex;
      const isCurrent = i === currentIndex;
      DOM.stepper.appendChild(buildStep(step, isDone, isCurrent));
    });
  }

  function buildStep(step, isDone, isCurrent) {
    const el = document.createElement('div');
    el.className = 'track-step' + (isDone ? ' is-done' : '') + (isCurrent ? ' is-current' : '');
    el.innerHTML = `
      <div class="track-step-line"></div>
      <div class="track-step-dot">${isDone ? '&#10003;' : ''}</div>
      <span class="track-step-label">${step.label}</span>
    `;
    return el;
  }

  function renderOrder(order) {
    DOM.orderId.innerText = order.id;

    renderStepper(order);

    if (order.status === 'Cancelled') {
      DOM.cancelledReason.innerText = order.rejection_reason
        ? order.rejection_reason
        : 'If you believe this is a mistake, please contact the seller.';
    }

    DOM.itemsList.innerHTML = (order.items || []).map(item => `
      <div class="track-item-row">
        <div>
          <span class="track-item-name">${item.title || 'Item'}</span>
          <span class="track-item-meta">${item.card_number ? '#' + item.card_number + ' &bull; ' : ''}Qty ${item.qty || item.quantity || 1}</span>
        </div>
        <span class="track-item-price">${formatPrice(Number(item.price || 0) * Number(item.qty || item.quantity || 1))}</span>
      </div>
    `).join('');

    DOM.subtotal.innerText = formatPrice(order.subtotal);
    DOM.shipping.innerText = formatPrice(order.shipping_fee);
    DOM.total.innerText = formatPrice(order.total);

    DOM.customer.innerText = order.customer_name || '-';
    DOM.courier.innerText = order.courier || '-';
    DOM.payment.innerText = order.payment_method || '-';
    DOM.placedAt.innerText = formatDate(order.created_at);

    scheduleProcessedTransition(order);
  }

  // If the order just became Paid and hasn't hit the processing delay yet,
  // fire a local timer for the remaining time so the step flips to Processed
  // right on schedule, without waiting for the next poll.
  function scheduleProcessedTransition(order) {
    if (processedTimer) {
      clearTimeout(processedTimer);
      processedTimer = null;
    }
    if (order.status !== 'Paid' || !order.paid_at || isProcessed(order)) return;

    const elapsed = Date.now() - new Date(order.paid_at).getTime();
    const remaining = Math.max(0, PROCESSED_DELAY_MS - elapsed);
    processedTimer = setTimeout(() => renderStepper(order), remaining + 50);
  }

  async function fetchOrder(isManualRefresh) {
    const orderId = getOrderIdFromUrl();
    if (!orderId) {
      showState('error');
      DOM.errorMsg.innerText = 'No order ID was provided in this link.';
      return;
    }

    if (isManualRefresh && DOM.refreshBtn) {
      DOM.refreshBtn.classList.add('is-spinning');
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/track`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Order not found');
      }
      renderOrder(data.order);
      showState('content');
      schedulePoll(data.order.status);
    } catch (err) {
      showState('error');
      DOM.errorMsg.innerText = err.message || 'We could not find this order.';
    } finally {
      if (DOM.refreshBtn) DOM.refreshBtn.classList.remove('is-spinning');
    }
  }

  function schedulePoll(status) {
    if (pollTimer) clearTimeout(pollTimer);
    if (TERMINAL_STATUSES.includes(status)) return;
    pollTimer = setTimeout(() => fetchOrder(false), POLL_INTERVAL_MS);
  }

  if (DOM.refreshBtn) {
    DOM.refreshBtn.addEventListener('click', () => fetchOrder(true));
  }

  showState('loading');
  fetchOrder(false);
})();
