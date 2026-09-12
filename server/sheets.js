/**
 * Google Sheets Webhook Integration
 * Sends new orders and status updates directly to Google Sheets via Google Apps Script Web App
 */

export async function sendOrderToGoogleSheets(orderData) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.trim()) {
    return false;
  }

  try {
    const payload = {
      action: 'new_order',
      order_id: orderData.orderId,
      date: new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
      status: orderData.status || 'Pending',
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      customer_address: orderData.customer_address,
      order_source: orderData.order_source,
      order_source_name: orderData.order_source_name,
      courier: orderData.courier,
      payment_method: orderData.payment_method,
      items: orderData.items || [],
      subtotal: orderData.subtotal,
      shipping_fee: orderData.shipping_fee,
      total: orderData.total,
      receipt_url: orderData.receipt_url
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Failed to send order to Google Sheets:', response.status, await response.text());
      return false;
    }

    console.log(`✓ Order ${orderData.orderId} synced to Google Sheets`);
    return true;
  } catch (error) {
    console.error('Error syncing order to Google Sheets:', error.message);
    return false;
  }
}

export async function updateOrderStatusInGoogleSheets(orderId, status) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.trim()) {
    return false;
  }

  try {
    const payload = {
      action: 'update_status',
      order_id: orderId,
      status: status
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Failed to update status in Google Sheets:', response.status, await response.text());
      return false;
    }

    console.log(`✓ Status for ${orderId} updated to "${status}" in Google Sheets`);
    return true;
  } catch (error) {
    console.error('Error updating status in Google Sheets:', error.message);
    return false;
  }
}
