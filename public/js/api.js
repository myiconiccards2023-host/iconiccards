/**
 * API client for Order Now backend
 */

// Not every non-2xx response is JSON — Vercel's platform layer rejects
// oversized request bodies (413) with a plain-text body before our Express
// code ever runs, and `res.json()` on that throws a cryptic parse error
// instead of a usable message. Parse defensively and fall back by status.
async function parseApiResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    if (res.status === 413) {
      return { error: 'That file is too large. Please use an image under 4MB and try again.' };
    }
    return { error: `Server error (${res.status}). Please try again.` };
  }
}

const API = {
  adminToken: localStorage.getItem('order_now_admin_token') || '',

  setAdminToken(token) {
    this.adminToken = token;
    if (token) {
      localStorage.setItem('order_now_admin_token', token);
    } else {
      localStorage.removeItem('order_now_admin_token');
    }
  },

  getAdminToken() {
    return this.adminToken || localStorage.getItem('order_now_admin_token') || 'IconicAdmin2023';
  },

  async getStoreInfo() {
    const res = await fetch('/api/store-info');
    if (!res.ok) throw new Error('Failed to fetch store info');
    return res.json();
  },

  async getProducts() {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async getCardStatus(productId, cardNumber) {
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}/cards/${cardNumber}`);
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load card status');
    }
    return data;
  },

  async submitOrder(formData) {
    const res = await fetch('/api/orders', {
      method: 'POST',
      body: formData
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit order');
    }
    return data;
  },

  async adminLogin(username, password) {
    let payload;
    if (typeof username === 'object' && username !== null) {
      payload = username;
    } else if (password !== undefined) {
      payload = { username, password };
    } else {
      payload = { password: username };
    }

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    this.setAdminToken(data.token);
    return data;
  },

  async addProduct(formData) {
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: {
        'x-admin-token': this.getAdminToken()
      },
      body: formData
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to add product');
    }
    return data;
  },

  async updateProduct(id, formData) {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'x-admin-token': this.getAdminToken()
      },
      body: formData
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update product');
    }
    return data;
  },

  async addProductPhotos(id, formData) {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/photos`, {
      method: 'POST',
      headers: {
        'x-admin-token': this.getAdminToken()
      },
      body: formData
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to add photos');
    }
    return data;
  },

  async removeProductPhoto(id, url) {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/photos/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': this.getAdminToken()
      },
      body: JSON.stringify({ url })
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to remove photo');
    }
    return data;
  },

  async updateCardRange(id, payload) {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/card-range`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': this.getAdminToken()
      },
      body: JSON.stringify(payload)
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update card number range');
    }
    return data;
  },

  async listAdminCards(productId, { status = 'All', search = '', page = 1, pageSize = 50 } = {}) {
    const params = new URLSearchParams({ status, search, page, pageSize });
    const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/cards?${params.toString()}`, {
      headers: { 'x-admin-token': this.getAdminToken() }
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load card numbers');
    }
    return data;
  },

  async setCardStatus(productId, cardNumber, status) {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/cards/${cardNumber}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': this.getAdminToken()
      },
      body: JSON.stringify({ status })
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update card status');
    }
    return data;
  },

  async bulkSetCardPrices(productId, prices) {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/cards/bulk-price`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': this.getAdminToken()
      },
      body: JSON.stringify({ prices })
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to set card prices');
    }
    return data;
  },

  async markOrderPaid(orderId) {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/mark-paid`, {
      method: 'POST',
      headers: { 'x-admin-token': this.getAdminToken() }
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to mark order as paid');
    }
    return data;
  },

  async rejectOrderPayment(orderId, reason) {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/reject-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': this.getAdminToken()
      },
      body: JSON.stringify({ reason })
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reject payment');
    }
    return data;
  },

  async deleteProduct(id) {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'x-admin-token': this.getAdminToken()
      }
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete product');
    }
    return data;
  },

  async getOrders() {
    const res = await fetch('/api/admin/orders', {
      headers: {
        'x-admin-token': this.getAdminToken()
      }
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load orders');
    }
    return data;
  },

  async updateOrderStatus(orderId, status) {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': this.getAdminToken()
      },
      body: JSON.stringify({ status })
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update status');
    }
    return data;
  },

  async resetBatch() {
    const res = await fetch('/api/admin/batch-reset', {
      method: 'POST',
      headers: {
        'x-admin-token': this.getAdminToken()
      }
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to reset batch');
    }
    return data;
  },

  async clearAllOrders() {
    const res = await fetch('/api/admin/orders', {
      method: 'DELETE',
      headers: {
        'x-admin-token': this.getAdminToken()
      }
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to clear customer transactions');
    }
    return data;
  },

  async deleteOrder(id) {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'x-admin-token': this.getAdminToken()
      }
    });
    const data = await parseApiResponse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete order');
    }
    return data;
  },

  getExportCsvUrl() {
    return `/api/admin/orders/export?admin_token=${encodeURIComponent(this.getAdminToken())}`;
  },

  getExportExcelUrl() {
    return `/api/admin/orders/export-excel?admin_token=${encodeURIComponent(this.getAdminToken())}`;
  }
};
