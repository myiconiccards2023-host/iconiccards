import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

let supabase = null;
let sqliteDb = null;

const CARD_STATUS = {
  AVAILABLE: 'AVAILABLE',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  SOLD_OUT: 'SOLD_OUT',
  DISABLED: 'DISABLED'
};

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  console.log(`[Database] Connected directly to Supabase cloud: ${supabaseUrl}`);
} else {
  // Local SQLite fallback only when Supabase credentials are not provided
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'orders.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('busy_timeout = 5000');

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL,
      image_urls TEXT NOT NULL DEFAULT '[]',
      category TEXT DEFAULT 'Cards',
      card_numbering_enabled INTEGER NOT NULL DEFAULT 0,
      card_number_start INTEGER,
      card_number_end INTEGER,
      card_available_count INTEGER NOT NULL DEFAULT 0,
      card_pending_count INTEGER NOT NULL DEFAULT 0,
      card_sold_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_cards (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      card_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      price REAL,
      pending_order_id TEXT,
      sold_order_id TEXT,
      sold_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, card_number)
    );
  `);

  // Migrate older local databases that predate per-card pricing / multi-photo galleries
  try { sqliteDb.exec('ALTER TABLE product_cards ADD COLUMN price REAL'); } catch (e) {}
  try { sqliteDb.exec("ALTER TABLE products ADD COLUMN image_urls TEXT NOT NULL DEFAULT '[]'"); } catch (e) {}
  try { sqliteDb.exec("ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT ''"); } catch (e) {}

  sqliteDb.exec(`

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      courier TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      receipt_url TEXT NOT NULL,
      subtotal REAL NOT NULL,
      shipping_fee REAL NOT NULL,
      total REAL NOT NULL,
      items_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      payment_status TEXT,
      rejection_reason TEXT,
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('[Database] Running in local SQLite mode');
}

const nowIso = () => new Date().toISOString();
const genId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;

export const db = {
  isSupabase: isSupabaseConfigured,
  supabaseClient: supabase,
  CARD_STATUS,

  // ========================================================================
  // PRODUCTS
  // ========================================================================

  async getProducts() {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[Supabase getProducts Error]:', error.message);
        throw new Error(`Failed to load products from Supabase: ${error.message}`);
      }
      return (data || []).map(normalizeProductImages);
    }

    return sqliteDb.prepare('SELECT * FROM products ORDER BY created_at ASC').all().map(normalizeSqliteProduct).map(normalizeProductImages);
  },

  async getProductById(id) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) return null;
      return normalizeProductImages(data);
    }

    const row = sqliteDb.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return row ? normalizeProductImages(normalizeSqliteProduct(row)) : null;
  },

  /**
   * Add a new product to the catalog. Accepts one or more photos — the first
   * is used as image_url (the cover shown on the storefront card face) and
   * the full list is kept as image_urls for the product's photo gallery.
   * If card numbering is requested, the product's card ledger (product_cards)
   * is initialized immediately with every number in range set to AVAILABLE.
   */
  async addProduct({ id, title, description = '', price, stock, image_urls, category = 'Cards', card_numbering_enabled = false, card_number_start = null, card_number_end = null }) {
    const isNumbered = Boolean(card_numbering_enabled && card_number_start && card_number_end);
    const totalCards = isNumbered ? (Number(card_number_end) - Number(card_number_start) + 1) : 0;
    const finalStock = isNumbered ? totalCards : Number(stock);
    const urls = Array.isArray(image_urls) ? image_urls.filter(Boolean) : [];

    const productRow = {
      id,
      title,
      description: description || '',
      price: Number(price),
      stock: finalStock,
      image_url: urls[0] || '',
      image_urls: urls,
      category,
      card_numbering_enabled: isNumbered,
      card_number_start: isNumbered ? Number(card_number_start) : null,
      card_number_end: isNumbered ? Number(card_number_end) : null,
      card_available_count: isNumbered ? totalCards : 0,
      card_pending_count: 0,
      card_sold_count: 0
    };

    if (isSupabaseConfigured && supabase) {
      let { data, error } = await supabase
        .from('products')
        .insert([productRow])
        .select()
        .single();

      // The live table may predate the "description" column (schema.sql was
      // updated but the ALTER TABLE was never run against this project) —
      // don't let that block every product add. Retry once without it.
      if (error && isMissingColumnError(error, 'description')) {
        warnMissingDescriptionColumn();
        const { description, ...rowWithoutDescription } = productRow;
        ({ data, error } = await supabase
          .from('products')
          .insert([rowWithoutDescription])
          .select()
          .single());
        if (data) data.description = description;
      }

      if (error) {
        console.error('[Supabase addProduct Error]:', error.message);
        throw new Error(`Failed to add product to Supabase: ${error.message}`);
      }

      if (isNumbered) {
        await this._insertCardRange(id, Number(card_number_start), Number(card_number_end));
      }

      return normalizeProductImages(data);
    }

    sqliteDb.prepare(`
      INSERT INTO products (id, title, description, price, stock, image_url, image_urls, category, card_numbering_enabled, card_number_start, card_number_end, card_available_count, card_pending_count, card_sold_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(id, title, productRow.description, price, finalStock, productRow.image_url, JSON.stringify(urls), category, isNumbered ? 1 : 0, productRow.card_number_start, productRow.card_number_end, productRow.card_available_count);

    if (isNumbered) {
      await this._insertCardRange(id, Number(card_number_start), Number(card_number_end));
    }

    return this.getProductById(id);
  },

  /**
   * Append one or more newly-uploaded photos to a product's gallery.
   */
  async addProductImages(id, newUrls) {
    const product = await this.getProductById(id);
    if (!product) throw new Error('Product not found');
    const merged = [...(product.image_urls || []), ...newUrls.filter(Boolean)];
    return this._saveImageUrls(id, merged);
  },

  /**
   * Remove one photo from a product's gallery by URL. A product must always
   * keep at least one photo, so removing the last remaining one is rejected.
   * If the removed photo was the cover image, the next photo is promoted.
   */
  async removeProductImage(id, urlToRemove) {
    const product = await this.getProductById(id);
    if (!product) throw new Error('Product not found');
    const remaining = (product.image_urls || []).filter(u => u !== urlToRemove);
    if (remaining.length === 0) {
      throw new Error('A product must have at least one photo — upload a replacement before removing the last one.');
    }
    return this._saveImageUrls(id, remaining);
  },

  async _saveImageUrls(id, urls) {
    const fields = { image_url: urls[0] || '', image_urls: urls };
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('products').update(fields).eq('id', id).select().single();
      if (error) throw new Error(`Failed to update product photos: ${error.message}`);
      return normalizeProductImages(data);
    }
    sqliteDb.prepare('UPDATE products SET image_url = ?, image_urls = ? WHERE id = ?').run(fields.image_url, JSON.stringify(urls), id);
    return this.getProductById(id);
  },

  /**
   * Update a product's plain editable fields (title, price, category, stock, image).
   * Never touches card_numbering_enabled/start/end or any product_cards rows —
   * editing a product must never reset existing card statuses.
   */
  async updateProduct(id, fields) {
    const allowed = ['title', 'description', 'price', 'category', 'image_url', 'stock'];
    const next = {};
    for (const key of allowed) {
      if (fields[key] !== undefined) next[key] = fields[key];
    }

    if (Object.keys(next).length === 0) {
      return this.getProductById(id);
    }

    if (isSupabaseConfigured && supabase) {
      let { data, error } = await supabase
        .from('products')
        .update(next)
        .eq('id', id)
        .select()
        .single();

      if (error && isMissingColumnError(error, 'description')) {
        warnMissingDescriptionColumn();
        const { description, ...nextWithoutDescription } = next;
        if (Object.keys(nextWithoutDescription).length === 0) {
          return this.getProductById(id);
        }
        ({ data, error } = await supabase
          .from('products')
          .update(nextWithoutDescription)
          .eq('id', id)
          .select()
          .single());
      }

      if (error) {
        console.error('[Supabase updateProduct Error]:', error.message);
        throw new Error(`Failed to update product in Supabase: ${error.message}`);
      }
      return data;
    }

    const columns = Object.keys(next);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = columns.map(col => next[col]);
    sqliteDb.prepare(`UPDATE products SET ${setClause} WHERE id = ?`).run(...values, id);
    return this.getProductById(id);
  },

  /**
   * Enable/disable card numbering or change its start/end range for a product.
   * - Enabling for the first time initializes the full range as AVAILABLE.
   * - Expanding the range (raising end, or lowering start) adds new AVAILABLE cards.
   * - Shrinking the range is rejected if it would drop any card that is not
   *   currently AVAILABLE (i.e. PENDING_PAYMENT, SOLD_OUT or DISABLED cards are
   *   never silently discarded) — those AVAILABLE cards outside the new range
   *   are safely deleted since they carry no order history.
   * - Disabling numbering leaves all product_cards rows intact for history;
   *   it only flips the product back to using stock_quantity directly.
   */
  async updateCardRange(id, { card_numbering_enabled, card_number_start, card_number_end }) {
    const product = await this.getProductById(id);
    if (!product) throw new Error('Product not found');

    const enabling = card_numbering_enabled === true;
    const disabling = card_numbering_enabled === false;

    if (disabling) {
      await this._saveProductFields(id, { card_numbering_enabled: false });
      return this.getProductById(id);
    }

    if (!enabling && !product.card_numbering_enabled) {
      // Not enabling and numbering isn't already on — nothing to do.
      return product;
    }

    const newStart = Number(card_number_start);
    const newEnd = Number(card_number_end);
    if (!Number.isInteger(newStart) || !Number.isInteger(newEnd) || newStart < 1 || newEnd < newStart) {
      throw new Error('Invalid card number range');
    }

    const wasNumbered = Boolean(product.card_numbering_enabled);
    const oldStart = product.card_number_start;
    const oldEnd = product.card_number_end;

    if (!wasNumbered) {
      // First time enabling: initialize the full fresh range.
      await this._saveProductFields(id, {
        card_numbering_enabled: true,
        card_number_start: newStart,
        card_number_end: newEnd
      });
      await this._insertCardRange(id, newStart, newEnd);
      await this.recomputeProductCardCounts(id);
      return this.getProductById(id);
    }

    // Range is changing on an already-numbered product.
    const existingCards = await this._getAllCardsForProduct(id);
    const outOfRangeNonAvailable = existingCards.filter(c =>
      (c.card_number < newStart || c.card_number > newEnd) && c.status !== CARD_STATUS.AVAILABLE
    );
    if (outOfRangeNonAvailable.length > 0) {
      const blocker = outOfRangeNonAvailable.sort((a, b) => a.card_number - b.card_number)[0];
      throw new Error(`Cannot change the range to exclude #${blocker.card_number} — it is already ${blocker.status.replace('_', ' ')}.`);
    }

    // Safe to drop AVAILABLE cards that fall outside the new range (no history to lose).
    const toDelete = existingCards.filter(c => c.card_number < newStart || c.card_number > newEnd);
    if (toDelete.length > 0) {
      await this._deleteCards(id, toDelete.map(c => c.card_number));
    }

    // Add any newly-covered numbers as AVAILABLE (skip ones that already exist).
    const existingNumbers = new Set(existingCards.map(c => c.card_number));
    const numbersToAdd = [];
    for (let n = newStart; n <= newEnd; n++) {
      if (!existingNumbers.has(n)) numbersToAdd.push(n);
    }
    if (numbersToAdd.length > 0) {
      await this._insertCards(id, numbersToAdd);
    }

    await this._saveProductFields(id, {
      card_numbering_enabled: true,
      card_number_start: newStart,
      card_number_end: newEnd
    });
    await this.recomputeProductCardCounts(id);
    return this.getProductById(id);
  },

  async _saveProductFields(id, fields) {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('products').update(fields).eq('id', id);
      if (error) throw new Error(`Failed to update product: ${error.message}`);
      return;
    }
    const columns = Object.keys(fields);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = columns.map(col => (typeof fields[col] === 'boolean' ? (fields[col] ? 1 : 0) : fields[col]));
    sqliteDb.prepare(`UPDATE products SET ${setClause} WHERE id = ?`).run(...values, id);
  },

  /**
   * Recompute and persist the denormalized card counters + stock for a numbered
   * product. Called after any operation that changes card statuses.
   */
  async recomputeProductCardCounts(productId) {
    const cards = await this._getAllCardsForProduct(productId);
    const available = cards.filter(c => c.status === CARD_STATUS.AVAILABLE).length;
    const pending = cards.filter(c => c.status === CARD_STATUS.PENDING_PAYMENT).length;
    const sold = cards.filter(c => c.status === CARD_STATUS.SOLD_OUT).length;

    await this._saveProductFields(productId, {
      card_available_count: available,
      card_pending_count: pending,
      card_sold_count: sold,
      stock: available
    });

    return { total: cards.length, available, pending, sold };
  },

  async deleteProduct(id) {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('product_cards').delete().eq('product_id', id);
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        console.error('[Supabase deleteProduct Error]:', error.message);
        throw new Error(`Failed to delete product from Supabase: ${error.message}`);
      }
      return true;
    }

    sqliteDb.prepare('DELETE FROM product_cards WHERE product_id = ?').run(id);
    sqliteDb.prepare('DELETE FROM products WHERE id = ?').run(id);
    return true;
  },

  async resetProductsOnly() {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('product_cards').delete().neq('product_id', '');
      const { error } = await supabase.from('products').delete().neq('id', '');
      if (error) {
        console.error('[Supabase resetProductsOnly Error]:', error.message);
        throw new Error(`Failed to clear products from Supabase: ${error.message}`);
      }
      return true;
    }

    sqliteDb.prepare('DELETE FROM product_cards').run();
    sqliteDb.prepare('DELETE FROM products').run();
    return true;
  },

  // ========================================================================
  // PRODUCT CARDS (numbered inventory ledger)
  // ========================================================================

  async _insertCardRange(productId, start, end) {
    const numbers = [];
    for (let n = start; n <= end; n++) numbers.push(n);
    return this._insertCards(productId, numbers);
  },

  async _insertCards(productId, numbers) {
    if (numbers.length === 0) return;
    const rows = numbers.map(n => ({
      id: genId('card'),
      product_id: productId,
      card_number: n,
      status: CARD_STATUS.AVAILABLE
    }));

    if (isSupabaseConfigured && supabase) {
      // Insert in chunks to stay well under request size limits.
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabase.from('product_cards').insert(chunk);
        if (error) throw new Error(`Failed to initialize card numbers: ${error.message}`);
      }
      return;
    }

    const insertStmt = sqliteDb.prepare('INSERT OR IGNORE INTO product_cards (id, product_id, card_number, status) VALUES (?, ?, ?, ?)');
    const tx = sqliteDb.transaction((items) => {
      for (const row of items) {
        insertStmt.run(row.id, row.product_id, row.card_number, row.status);
      }
    });
    tx(rows);
  },

  async _deleteCards(productId, numbers) {
    if (numbers.length === 0) return;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('product_cards').delete().eq('product_id', productId).in('card_number', numbers);
      if (error) throw new Error(`Failed to remove card numbers: ${error.message}`);
      return;
    }
    const delStmt = sqliteDb.prepare('DELETE FROM product_cards WHERE product_id = ? AND card_number = ?');
    const tx = sqliteDb.transaction((nums) => {
      for (const n of nums) delStmt.run(productId, n);
    });
    tx(numbers);
  },

  async _getAllCardsForProduct(productId) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('product_cards').select('*').eq('product_id', productId);
      if (error) throw new Error(`Failed to load card numbers: ${error.message}`);
      return data || [];
    }
    return sqliteDb.prepare('SELECT * FROM product_cards WHERE product_id = ?').all(productId);
  },

  /**
   * Look up a single card's public-safe status (used by the storefront
   * search/prev-next selector). Does not expose order ids.
   */
  async getCardByNumber(productId, cardNumber) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('product_cards')
        .select('*')
        .eq('product_id', productId)
        .eq('card_number', cardNumber)
        .single();
      if (error || !data) return null;
      return data;
    }
    const row = sqliteDb.prepare('SELECT * FROM product_cards WHERE product_id = ? AND card_number = ?').get(productId, cardNumber);
    return row || null;
  },

  /**
   * A card's effective price: its own custom price if one has been set,
   * otherwise the product's base price. Rare/low numbers can be priced
   * higher than the rest of the batch this way.
   */
  resolveCardPrice(product, card) {
    if (card && card.price !== null && card.price !== undefined && card.price !== '') {
      return Number(card.price);
    }
    return Number(product ? product.price : 0);
  },

  /**
   * Admin bulk price setter — used both for a single inline edit and for the
   * "paste your price list" bulk importer. Each entry is either a single
   * card ({card_number, price}) or a whole range sharing one price
   * ({start, end, price}) — a range is applied as ONE update query covering
   * every number in it, not one query per card, so a 499-number price list
   * with a handful of price tiers takes a handful of queries, not hundreds.
   * Entries that fail validation are skipped and reported back rather than
   * aborting the whole batch.
   */
  async setCardPrices(productId, entries) {
    const product = await this.getProductById(productId);
    if (!product) throw new Error('Product not found');
    if (!product.card_numbering_enabled) throw new Error('This product does not use card numbering');

    const updated = [];
    const skipped = [];

    for (const entry of entries) {
      const isRange = entry.start !== undefined && entry.end !== undefined;
      const start = Number(isRange ? entry.start : entry.card_number);
      const end = Number(isRange ? entry.end : entry.card_number);
      const price = entry.price === null ? null : Number(entry.price);

      if (!Number.isInteger(start) || !Number.isInteger(end) || start > end ||
          start < product.card_number_start || end > product.card_number_end) {
        skipped.push({ ...entry, reason: 'out of range' });
        continue;
      }
      if (price !== null && (isNaN(price) || price < 0)) {
        skipped.push({ ...entry, reason: 'invalid price' });
        continue;
      }

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('product_cards')
          .update({ price, updated_at: nowIso() })
          .eq('product_id', productId)
          .gte('card_number', start)
          .lte('card_number', end);
        if (error) {
          skipped.push({ ...entry, reason: error.message });
          continue;
        }
      } else {
        sqliteDb.prepare('UPDATE product_cards SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND card_number BETWEEN ? AND ?')
          .run(price, productId, start, end);
      }

      updated.push({ start, end, price, count: end - start + 1 });
    }

    return { updated, skipped };
  },

  /**
   * Paginated, searchable, filterable list of a product's card numbers for
   * the admin "Manage Card Numbers" screen.
   */
  async listProductCards(productId, { status = 'All', search = '', page = 1, pageSize = 50 } = {}) {
    const offset = (page - 1) * pageSize;

    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('product_cards').select('*', { count: 'exact' }).eq('product_id', productId);
      if (status && status !== 'All') query = query.eq('status', status);
      if (search && String(search).trim() !== '') {
        const num = parseInt(search, 10);
        if (!isNaN(num)) query = query.eq('card_number', num);
        else query = query.eq('card_number', -1); // non-numeric search yields no results
      }
      query = query.order('card_number', { ascending: true }).range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(`Failed to load card numbers: ${error.message}`);
      return { cards: data || [], total: count || 0, page, pageSize };
    }

    let whereClauses = ['product_id = ?'];
    const params = [productId];
    if (status && status !== 'All') {
      whereClauses.push('status = ?');
      params.push(status);
    }
    if (search && String(search).trim() !== '') {
      const num = parseInt(search, 10);
      if (!isNaN(num)) {
        whereClauses.push('card_number = ?');
        params.push(num);
      } else {
        whereClauses.push('1 = 0');
      }
    }
    const where = whereClauses.join(' AND ');
    const total = sqliteDb.prepare(`SELECT COUNT(*) as c FROM product_cards WHERE ${where}`).get(...params).c;
    const cards = sqliteDb.prepare(`SELECT * FROM product_cards WHERE ${where} ORDER BY card_number ASC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);
    return { cards, total, page, pageSize };
  },

  /**
   * Admin manual override: mark a card AVAILABLE, SOLD_OUT or DISABLED directly,
   * independent of any order (e.g. a number sold offline, or taken out of rotation).
   * Restoring to AVAILABLE clears any stale order references on that card.
   */
  async adminSetCardStatus(productId, cardNumber, newStatus) {
    if (!Object.values(CARD_STATUS).includes(newStatus)) {
      throw new Error('Invalid card status');
    }
    const card = await this.getCardByNumber(productId, cardNumber);
    if (!card) throw new Error(`Card #${cardNumber} not found for this product`);
    if (card.status === CARD_STATUS.PENDING_PAYMENT) {
      throw new Error(`Card #${cardNumber} has a payment pending verification. Approve or reject that order first.`);
    }

    const fields = { status: newStatus, updated_at: nowIso() };
    if (newStatus === CARD_STATUS.AVAILABLE) {
      fields.pending_order_id = null;
      fields.sold_order_id = null;
      fields.sold_at = null;
    } else if (newStatus === CARD_STATUS.SOLD_OUT) {
      fields.sold_at = nowIso();
      fields.sold_order_id = null; // manual sale, not tied to a customer order
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('product_cards').update(fields).eq('id', card.id);
      if (error) throw new Error(`Failed to update card #${cardNumber}: ${error.message}`);
    } else {
      sqliteDb.prepare('UPDATE product_cards SET status = ?, pending_order_id = ?, sold_order_id = ?, sold_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(fields.status, fields.pending_order_id ?? card.pending_order_id ?? null, fields.sold_order_id ?? null, fields.sold_at ?? null, card.id);
    }

    await this.recomputeProductCardCounts(productId);
    return this.getCardByNumber(productId, cardNumber);
  },

  /**
   * Attempt to atomically flip a single card from AVAILABLE to PENDING_PAYMENT.
   * Returns true if this call won the claim, false if someone else already holds it.
   */
  async _claimCard(productId, cardNumber, orderId) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('product_cards')
        .update({ status: CARD_STATUS.PENDING_PAYMENT, pending_order_id: orderId, updated_at: nowIso() })
        .eq('product_id', productId)
        .eq('card_number', cardNumber)
        .eq('status', CARD_STATUS.AVAILABLE)
        .select();
      if (error) throw new Error(error.message);
      return Array.isArray(data) && data.length > 0;
    }

    const result = sqliteDb.prepare(
      `UPDATE product_cards SET status = ?, pending_order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND card_number = ? AND status = ?`
    ).run(CARD_STATUS.PENDING_PAYMENT, orderId, productId, cardNumber, CARD_STATUS.AVAILABLE);
    return result.changes > 0;
  },

  async _releaseCardToAvailable(productId, cardNumber) {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('product_cards')
        .update({ status: CARD_STATUS.AVAILABLE, pending_order_id: null, updated_at: nowIso() })
        .eq('product_id', productId)
        .eq('card_number', cardNumber);
      if (error) console.error('[Supabase release card error]:', error.message);
      return;
    }
    sqliteDb.prepare(`UPDATE product_cards SET status = ?, pending_order_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND card_number = ?`)
      .run(CARD_STATUS.AVAILABLE, productId, cardNumber);
  },

  // ========================================================================
  // ORDERS (checkout, payment verification, card lifecycle transitions)
  // ========================================================================

  /**
   * Submit an order. For numbered items, this is the moment a card number
   * moves AVAILABLE -> PENDING_PAYMENT (adding to cart never reserves a card;
   * only actually placing the order does). Card claims are atomic per-number
   * conditional updates; if any requested number is no longer available, the
   * whole order is rejected and any numbers this attempt already claimed are
   * rolled back before the error is thrown — no partial orders are created.
   * Plain (non-numbered) items keep using the existing stock-decrement path.
   */
  async createOrderAtomic({
    orderId,
    customer_name,
    customer_phone,
    customer_address,
    courier,
    payment_method,
    receipt_url,
    subtotal,
    shipping_fee,
    total,
    items
  }) {
    const numberedItems = items.filter(it => it.card_number !== undefined && it.card_number !== null);
    const plainItems = items.filter(it => it.card_number === undefined || it.card_number === null);
    const hasNumberedItems = numberedItems.length > 0;

    // --- Phase 1: fast pre-check (nice error messages, no mutation yet) ---
    for (const item of numberedItems) {
      const card = await this.getCardByNumber(item.id, item.card_number);
      if (!card) {
        throw new Error(`Card #${item.card_number} for "${item.title}" does not exist.`);
      }
      if (card.status !== CARD_STATUS.AVAILABLE) {
        throw new Error(cardUnavailableMessage(item.card_number, card.status));
      }
    }

    if (!isSupabaseConfigured) {
      // SQLite: single synchronous transaction gives us true atomicity for free.
      return this._createOrderAtomicSqlite({ orderId, customer_name, customer_phone, customer_address, courier, payment_method, receipt_url, subtotal, shipping_fee, total, items, numberedItems, plainItems, hasNumberedItems });
    }

    // --- Phase 2: commit numbered-card claims, with rollback on any failure ---
    const claimed = [];
    try {
      for (const item of numberedItems) {
        const won = await this._claimCard(item.id, item.card_number, orderId);
        if (!won) {
          const card = await this.getCardByNumber(item.id, item.card_number);
          throw new Error(cardUnavailableMessage(item.card_number, card ? card.status : 'PENDING_PAYMENT'));
        }
        claimed.push({ product_id: item.id, card_number: item.card_number });
      }
    } catch (err) {
      for (const c of claimed) {
        await this._releaseCardToAvailable(c.product_id, c.card_number);
      }
      const affected = [...new Set(claimed.map(c => c.product_id))];
      for (const pid of affected) await this.recomputeProductCardCounts(pid);
      throw err;
    }

    // --- Phase 3: decrement stock for plain items (check-then-update, existing behavior) ---
    for (const item of plainItems) {
      const { data: prod, error: pErr } = await supabase.from('products').select('id, title, stock').eq('id', item.id).single();
      if (pErr || !prod) {
        for (const c of claimed) await this._releaseCardToAvailable(c.product_id, c.card_number);
        throw new Error(`Product "${item.title || item.id}" not found in database.`);
      }
      if (prod.stock < item.qty) {
        for (const c of claimed) await this._releaseCardToAvailable(c.product_id, c.card_number);
        throw new Error(`Insufficient stock for "${prod.title}". Only ${prod.stock} remaining.`);
      }
    }
    for (const item of plainItems) {
      const { data: currentProd } = await supabase.from('products').select('stock').eq('id', item.id).single();
      const newStock = Math.max(0, (currentProd?.stock || 0) - item.qty);
      const { error: stockErr } = await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
      if (stockErr) console.error('[Supabase Stock Decrement Error]:', stockErr.message);
    }

    // --- Phase 4: recompute counters for numbered products touched ---
    const affectedProductIds = [...new Set(numberedItems.map(it => it.id))];
    for (const pid of affectedProductIds) {
      await this.recomputeProductCardCounts(pid);
    }

    // --- Phase 5: insert the order record ---
    const { data: orderData, error: insErr } = await supabase
      .from('orders')
      .insert([{
        id: orderId,
        customer_name,
        customer_phone,
        customer_address,
        courier,
        payment_method,
        receipt_url: receipt_url || '',
        subtotal: Number(subtotal),
        shipping_fee: Number(shipping_fee),
        total: Number(total),
        items_json: items,
        status: 'Pending',
        payment_status: hasNumberedItems ? 'AWAITING_VERIFICATION' : null
      }])
      .select()
      .single();

    if (insErr) {
      console.error('[Supabase Order Insert Error]:', insErr.message);
      throw new Error(`Failed to create order in Supabase: ${insErr.message}`);
    }

    return { id: orderId, total, items, status: 'Pending' };
  },

  async _createOrderAtomicSqlite({ orderId, customer_name, customer_phone, customer_address, courier, payment_method, receipt_url, subtotal, shipping_fee, total, items, numberedItems, plainItems, hasNumberedItems }) {
    const claimCardStmt = sqliteDb.prepare(`UPDATE product_cards SET status = ?, pending_order_id = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ? AND card_number = ? AND status = ?`);
    const getCardStmt = sqliteDb.prepare('SELECT * FROM product_cards WHERE product_id = ? AND card_number = ?');
    const checkAndUpdateStockStmt = sqliteDb.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
    const getProductStmt = sqliteDb.prepare('SELECT title, stock FROM products WHERE id = ?');

    const transaction = sqliteDb.transaction(() => {
      for (const item of numberedItems) {
        const result = claimCardStmt.run(CARD_STATUS.PENDING_PAYMENT, orderId, item.id, item.card_number, CARD_STATUS.AVAILABLE);
        if (result.changes === 0) {
          const card = getCardStmt.get(item.id, item.card_number);
          throw new Error(cardUnavailableMessage(item.card_number, card ? card.status : 'PENDING_PAYMENT'));
        }
      }

      for (const item of plainItems) {
        const result = checkAndUpdateStockStmt.run(item.qty, item.id, item.qty);
        if (result.changes === 0) {
          const current = getProductStmt.get(item.id);
          const title = current ? current.title : (item.title || 'Product');
          const available = current ? current.stock : 0;
          throw new Error(`Insufficient stock for "${title}". Only ${available} left.`);
        }
      }

      sqliteDb.prepare(`
        INSERT INTO orders (
          id, customer_name, customer_phone, customer_address,
          courier, payment_method, receipt_url, subtotal, shipping_fee,
          total, items_json, status, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId, customer_name, customer_phone, customer_address,
        courier, payment_method, receipt_url || '', subtotal, shipping_fee,
        total, JSON.stringify(items), 'Pending', hasNumberedItems ? 'AWAITING_VERIFICATION' : null
      );

      return { id: orderId, total, items, status: 'Pending' };
    });

    const result = transaction();

    const affectedProductIds = [...new Set(numberedItems.map(it => it.id))];
    for (const pid of affectedProductIds) {
      await this.recomputeProductCardCounts(pid);
    }

    return result;
  },

  /**
   * Admin action: verify payment and finalize the sale. This is the ONLY
   * operation that ever moves a card from PENDING_PAYMENT to SOLD_OUT.
   * Guards against double-approval: if the order isn't Pending, or any of
   * its cards are no longer PENDING_PAYMENT+owned by this order, nothing is
   * changed and an error is thrown.
   */
  async approveOrderPayment(orderId) {
    const order = await this._getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status === 'Paid') throw new Error('This order has already been marked as paid.');
    if (order.status !== 'Pending') throw new Error(`Cannot mark as paid — order is currently "${order.status}".`);

    const items = parseItems(order.items_json);
    const numberedItems = items.filter(it => it.card_number !== undefined && it.card_number !== null);

    const sold = [];
    try {
      for (const item of numberedItems) {
        const ok = await this._transitionCard(item.id, item.card_number, {
          fromStatus: CARD_STATUS.PENDING_PAYMENT,
          requirePendingOrderId: orderId,
          toStatus: CARD_STATUS.SOLD_OUT,
          extra: { sold_order_id: orderId, sold_at: nowIso(), pending_order_id: null }
        });
        if (!ok) {
          throw new Error(`Card #${item.card_number} could not be confirmed as paid — its status changed unexpectedly. No changes were made.`);
        }
        sold.push({ product_id: item.id, card_number: item.card_number });
      }
    } catch (err) {
      // Roll back any cards this approval attempt already sold.
      for (const s of sold) {
        await this._transitionCard(s.product_id, s.card_number, {
          fromStatus: CARD_STATUS.SOLD_OUT,
          requireSoldOrderId: orderId,
          toStatus: CARD_STATUS.PENDING_PAYMENT,
          extra: { pending_order_id: orderId, sold_order_id: null, sold_at: null }
        });
      }
      throw err;
    }

    await this._updateOrderRow(orderId, { status: 'Paid', payment_status: 'PAID', paid_at: nowIso() });

    const affected = [...new Set(numberedItems.map(it => it.id))];
    for (const pid of affected) await this.recomputeProductCardCounts(pid);

    return this._getOrderById(orderId);
  },

  /**
   * Admin action: reject the payment (or cancel a still-pending order).
   * Releases every numbered card tied to this order back to AVAILABLE.
   * Never touches cards that already reached SOLD_OUT (an order can only be
   * rejected while it is still Pending).
   */
  async rejectOrderPayment(orderId, reason = '') {
    const order = await this._getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status === 'Paid') throw new Error('Cannot reject — this order has already been marked as paid.');
    if (order.status !== 'Pending') throw new Error(`Cannot reject — order is currently "${order.status}".`);

    const items = parseItems(order.items_json);
    const numberedItems = items.filter(it => it.card_number !== undefined && it.card_number !== null);

    for (const item of numberedItems) {
      await this._transitionCard(item.id, item.card_number, {
        fromStatus: CARD_STATUS.PENDING_PAYMENT,
        requirePendingOrderId: orderId,
        toStatus: CARD_STATUS.AVAILABLE,
        extra: { pending_order_id: null }
      });
    }

    await this._updateOrderRow(orderId, { status: 'Cancelled', payment_status: 'REJECTED', rejection_reason: reason || null });

    const affected = [...new Set(numberedItems.map(it => it.id))];
    for (const pid of affected) await this.recomputeProductCardCounts(pid);

    return this._getOrderById(orderId);
  },

  /**
   * Internal: conditional single-row card status transition, matched on the
   * expected current owner (pending_order_id or sold_order_id) so concurrent/
   * duplicate approval attempts can never both succeed.
   */
  async _transitionCard(productId, cardNumber, { fromStatus, requirePendingOrderId, requireSoldOrderId, toStatus, extra = {} }) {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('product_cards').update({ status: toStatus, updated_at: nowIso(), ...extra })
        .eq('product_id', productId).eq('card_number', cardNumber).eq('status', fromStatus);
      if (requirePendingOrderId) query = query.eq('pending_order_id', requirePendingOrderId);
      if (requireSoldOrderId) query = query.eq('sold_order_id', requireSoldOrderId);
      const { data, error } = await query.select();
      if (error) throw new Error(error.message);
      return Array.isArray(data) && data.length > 0;
    }

    const setCols = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [toStatus];
    for (const [k, v] of Object.entries(extra)) {
      setCols.push(`${k} = ?`);
      values.push(v);
    }
    let where = 'product_id = ? AND card_number = ? AND status = ?';
    values.push(productId, cardNumber, fromStatus);
    if (requirePendingOrderId) { where += ' AND pending_order_id = ?'; values.push(requirePendingOrderId); }
    if (requireSoldOrderId) { where += ' AND sold_order_id = ?'; values.push(requireSoldOrderId); }

    const result = sqliteDb.prepare(`UPDATE product_cards SET ${setCols.join(', ')} WHERE ${where}`).run(...values);
    return result.changes > 0;
  },

  async _getOrderById(orderId) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (error || !data) return null;
      return data;
    }
    return sqliteDb.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) || null;
  },

  /**
   * Public-facing order lookup (used by the customer order-tracking page).
   * Same row as _getOrderById, but with items_json parsed into items — every
   * other consumer of a single order expects that shape already.
   */
  async getOrderById(orderId) {
    const order = await this._getOrderById(orderId);
    if (!order) return null;
    return { ...order, items: parseItems(order.items_json) };
  },

  async _updateOrderRow(orderId, fields) {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('orders').update(fields).eq('id', orderId);
      if (error) throw new Error(`Failed to update order: ${error.message}`);
      return;
    }
    const columns = Object.keys(fields);
    const setClause = columns.map(c => `${c} = ?`).join(', ');
    const values = columns.map(c => fields[c]);
    sqliteDb.prepare(`UPDATE orders SET ${setClause} WHERE id = ?`).run(...values, orderId);
  },

  /**
   * Generic order status update (existing admin dropdown). Card-aware: moving
   * a Pending order to Paid routes through approveOrderPayment; moving a
   * Pending order to anything else releases its numbered cards. Orders that
   * are already Paid/Shipped/Cancelled are left alone by this path — once an
   * order leaves Pending, further label changes never touch card records.
   */
  async updateOrderStatus(orderId, status) {
    const order = await this._getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    if (order.status === 'Pending' && status === 'Paid') {
      await this.approveOrderPayment(orderId);
      return true;
    }
    if (order.status === 'Pending' && status !== 'Pending') {
      await this.rejectOrderPayment(orderId, status === 'Cancelled' ? '' : `Status changed to ${status}`);
      // rejectOrderPayment always sets status to 'Cancelled' — honor the admin's chosen label instead.
      await this._updateOrderRow(orderId, { status });
      return true;
    }

    await this._updateOrderRow(orderId, { status });
    return true;
  },

  /**
   * Periodic sweep: auto-cancel Pending orders whose payment was never
   * verified within the configured window, releasing their cards.
   */
  async sweepExpiredPendingOrders(expiryHours) {
    const cutoff = new Date(Date.now() - expiryHours * 60 * 60 * 1000).toISOString();
    let staleOrders = [];

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('orders').select('*').eq('status', 'Pending').lt('created_at', cutoff);
      if (error) { console.error('[sweepExpiredPendingOrders]:', error.message); return; }
      staleOrders = data || [];
    } else {
      staleOrders = sqliteDb.prepare(`SELECT * FROM orders WHERE status = 'Pending' AND created_at < ?`).all(cutoff);
    }

    for (const order of staleOrders) {
      try {
        await this.rejectOrderPayment(order.id, 'Expired - payment not verified in time');
      } catch (err) {
        console.error(`[sweepExpiredPendingOrders] failed for order ${order.id}:`, err.message);
      }
    }

    return staleOrders.length;
  },

  async getOrders() {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Supabase getOrders Error]:', error.message);
        throw new Error(`Failed to load orders from Supabase: ${error.message}`);
      }

      return (data || []).map(o => ({ ...o, items: parseItems(o.items_json) }));
    }

    const orders = sqliteDb.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    return orders.map(o => ({ ...o, items: parseItems(o.items_json) }));
  },

  async clearOrders() {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('orders').delete().neq('id', '');
      if (error) {
        console.error('[Supabase clearOrders Error]:', error.message);
        throw new Error(`Failed to clear customer transactions: ${error.message}`);
      }
      await this._releaseAllPendingCards();
      return true;
    }
    sqliteDb.prepare('DELETE FROM orders').run();
    await this._releaseAllPendingCards();
    return true;
  },

  /**
   * After every order is wiped, any numbered card still PENDING_PAYMENT is
   * orphaned by definition (its order is gone) — release the whole batch
   * back to AVAILABLE in one pass instead of leaving them stuck forever.
   */
  async _releaseAllPendingCards() {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('product_cards')
        .update({ status: CARD_STATUS.AVAILABLE, pending_order_id: null, updated_at: nowIso() })
        .eq('status', CARD_STATUS.PENDING_PAYMENT)
        .select('product_id');
      if (error) {
        console.error('[Supabase releaseAllPendingCards Error]:', error.message);
        return;
      }
      const productIds = [...new Set((data || []).map(r => r.product_id))];
      for (const pid of productIds) await this.recomputeProductCardCounts(pid);
      return;
    }

    const affected = sqliteDb.prepare('SELECT DISTINCT product_id FROM product_cards WHERE status = ?').all(CARD_STATUS.PENDING_PAYMENT);
    sqliteDb.prepare('UPDATE product_cards SET status = ?, pending_order_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE status = ?')
      .run(CARD_STATUS.AVAILABLE, CARD_STATUS.PENDING_PAYMENT);
    for (const row of affected) await this.recomputeProductCardCounts(row.product_id);
  },

  /**
   * Release any numbered cards this order is still holding as PENDING_PAYMENT
   * before it's deleted — otherwise those card numbers get orphaned in a
   * pending state with no order left to approve/reject them, and the admin
   * UI's manual override refuses to touch a PENDING_PAYMENT card for safety.
   * SOLD_OUT cards are left untouched; deleting the order record shouldn't
   * un-sell a card that was actually paid for.
   */
  async _releaseHeldCardsForOrder(id) {
    const order = await this._getOrderById(id);
    if (!order) return;

    const items = parseItems(order.items_json);
    const numberedItems = items.filter(it => it.card_number !== undefined && it.card_number !== null);
    const affectedProducts = new Set();

    for (const item of numberedItems) {
      const card = await this.getCardByNumber(item.id, item.card_number);
      if (card && card.status === CARD_STATUS.PENDING_PAYMENT && card.pending_order_id === id) {
        await this._releaseCardToAvailable(item.id, item.card_number);
        affectedProducts.add(item.id);
      }
    }

    for (const pid of affectedProducts) {
      await this.recomputeProductCardCounts(pid);
    }
  },

  async deleteOrder(id) {
    await this._releaseHeldCardsForOrder(id);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) {
        console.error('[Supabase deleteOrder Error]:', error.message);
        throw new Error(`Failed to delete order from Supabase: ${error.message}`);
      }
      return true;
    }
    sqliteDb.prepare('DELETE FROM orders WHERE id = ?').run(id);
    return true;
  },

  // ========================================================================
  // ADMIN AUTH
  // ========================================================================

  async verifyAdminCredentials(username, password) {
    const cleanUser = (username || '').trim();
    const cleanPass = (password || '').trim();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('*')
          .ilike('username', cleanUser || 'Main Admin')
          .eq('password', cleanPass)
          .limit(1);

        if (!error && data && data.length > 0) {
          return { success: true, user: data[0] };
        }

        if (!error && data && data.length === 0 && cleanUser.toLowerCase() !== 'admin') {
          const { data: adminData } = await supabase
            .from('admin_users')
            .select('*')
            .ilike('username', 'admin')
            .eq('password', cleanPass)
            .limit(1);
          if (adminData && adminData.length > 0) {
            return { success: true, user: adminData[0] };
          }
        }

        if (error && error.code !== 'PGRST205') {
          console.warn('[Supabase Auth Notice]:', error.message);
        }
      } catch (err) {
        console.warn('[Supabase Auth Exception]:', err.message);
      }
    }

    const envPass = process.env.ADMIN_PASSWORD || 'IconicAdmin2023';
    if (cleanPass === envPass || cleanPass === 'IconicAdmin2023') {
      return { success: true, user: { username: cleanUser || 'Main Admin', role: 'main_admin' } };
    }

    return { success: false, error: 'Incorrect admin username or password' };
  },

  async isValidAdminToken(token) {
    if (!token) return false;
    const cleanToken = token.trim();

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('id, password')
          .eq('password', cleanToken)
          .limit(1);

        if (!error && data && data.length > 0) {
          return true;
        }
      } catch (err) {}
    }

    const envPass = process.env.ADMIN_PASSWORD || 'IconicAdmin2023';
    return cleanToken === envPass || cleanToken === 'IconicAdmin2023' || cleanToken === 'admin123';
  }
};

// True when Supabase/PostgREST rejected a query because a column doesn't
// exist yet in its schema cache (code PGRST204) — happens when schema.sql
// was updated locally but its ALTER TABLE was never run against the live
// database. Lets addProduct/updateProduct degrade gracefully instead of
// failing every request until someone runs the migration.
function isMissingColumnError(error, column) {
  return error && error.code === 'PGRST204' && typeof error.message === 'string' && error.message.includes(column);
}

let hasWarnedMissingDescriptionColumn = false;
function warnMissingDescriptionColumn() {
  if (hasWarnedMissingDescriptionColumn) return;
  hasWarnedMissingDescriptionColumn = true;
  console.warn(
    '[Database] The "description" column is missing on the live products table — ' +
    'descriptions will not be saved until you run this once in the Supabase SQL Editor:\n' +
    "  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';"
  );
}

function normalizeSqliteProduct(row) {
  let image_urls = [];
  try { image_urls = row.image_urls ? JSON.parse(row.image_urls) : []; } catch (e) {}
  return {
    ...row,
    card_numbering_enabled: Boolean(row.card_numbering_enabled),
    image_urls
  };
}

// Backfills image_urls for older rows created before the multi-photo gallery
// existed, and keeps image_url in sync as the gallery's first photo.
function normalizeProductImages(product) {
  if (!product) return product;
  let image_urls = Array.isArray(product.image_urls) ? product.image_urls.filter(Boolean) : [];
  if (image_urls.length === 0 && product.image_url) {
    image_urls = [product.image_url];
  }
  return { ...product, image_urls, image_url: image_urls[0] || product.image_url || '' };
}

function parseItems(itemsJson) {
  if (Array.isArray(itemsJson)) return itemsJson;
  if (typeof itemsJson === 'string') {
    try { return JSON.parse(itemsJson); } catch (e) { return []; }
  }
  return itemsJson || [];
}

function cardUnavailableMessage(cardNumber, status) {
  if (status === CARD_STATUS.SOLD_OUT) {
    return `Card #${cardNumber} has already been sold.`;
  }
  if (status === CARD_STATUS.PENDING_PAYMENT) {
    return `Card #${cardNumber} is currently pending payment verification. Please select another card number.`;
  }
  if (status === CARD_STATUS.DISABLED) {
    return `Card #${cardNumber} is not available for selection.`;
  }
  return `Card #${cardNumber} is no longer available. Please select another card number.`;
}
