/**
 * Google Apps Script for Order Now
 *
 * Exact column sequence:
 * A: Order ID
 * B: Date
 * C: Status
 * D: Name of Product
 * E: Price
 * F: Quantity
 * G: Phone Number
 * H: Location / Address
 * I: Courier
 * J: Mode of Payment
 * K: Subtotal
 * L: Shipping
 * M: Grand Total
 * N: Photo of Receipt
 */

function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);

    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // ACTION 1: UPDATE STATUS OF EXISTING ORDER
    if (data.action === "update_status") {
      var targetOrderId = String(data.order_id || "").trim();
      var newStatus = String(data.status || "").trim();
      var lastRow = sheet.getLastRow();
      var updatedCount = 0;

      if (lastRow > 1) {
        // Read Order IDs from Column A
        var orderIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var r = 0; r < orderIds.length; r++) {
          if (String(orderIds[r][0]).trim() === targetOrderId) {
            // Update Column C (Status)
            sheet.getRange(r + 2, 3).setValue(newStatus);
            updatedCount++;
          }
        }
      }

      lock.releaseLock();
      return ContentService
        .createTextOutput(JSON.stringify({ result: "success", action: "update_status", updatedRows: updatedCount }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION 2: INSERT NEW ORDER
    // Auto-create and format header row if sheet is brand new
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Order ID",
        "Date",
        "Status",
        "Name of Product",
        "Price",
        "Quantity",
        "Phone Number",
        "Location / Address",
        "Courier",
        "Mode of Payment",
        "Subtotal",
        "Shipping",
        "Grand Total",
        "Photo of Receipt"
      ]);

      sheet.getRange(1, 1, 1, 14)
        .setFontWeight("bold")
        .setBackground("#1e1e1e")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    var items = data.items && data.items.length > 0 ? data.items : [{ title: "N/A", price: data.subtotal, qty: 1 }];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var isFirst = (i === 0);

      sheet.appendRow([
        data.order_id || "",
        data.date || new Date().toLocaleString(),
        data.status || "Pending",
        item.title || "",
        item.price || 0,
        item.qty || 1,
        "'" + (data.customer_phone || ""), // Prefix with ' to preserve leading zero in phone numbers
        data.customer_address || "",
        data.courier || "",
        data.payment_method || "",
        isFirst ? (data.subtotal || 0) : "",
        isFirst ? (data.shipping_fee || 0) : "",
        isFirst ? (data.total || 0) : "",
        data.receipt_url || ""
      ]);
    }

    lock.releaseLock();
    return ContentService
      .createTextOutput(JSON.stringify({ result: "success", action: "new_order" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
