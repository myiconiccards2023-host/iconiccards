# Order Now — Direct Batch Ordering Web App

A minimal, lightning-fast, mobile-first web app tailored for small online businesses and direct sellers dropping limited product batches via a single shared link (in Instagram bio, Messenger, TikTok, or WhatsApp).

Two views: **Customer View** (no login required, high conversion) and **Admin View** (password-gated).

---

## Key Features

- **Single Shared Link**: Reusable indefinitely across multiple future product batches.
- **Strictly Real Photos**: No placeholder images or mock data. Products only appear when real photos are uploaded.
- **Mobile-First UX**: Responsive, works smoothly in Messenger/Instagram in-app WebViews with glassmorphism touches and haptic-like micro-interactions.
- **Atomic Concurrency Protection**: High-volume drops prevent overselling via transactional conditional decrements (`UPDATE products SET stock = stock - qty WHERE id = ? AND stock >= qty`).
- **Live Cart & Floating Bar**: Dynamic quantity selector (+/-), instant stock status badges, automatic disablement when out of stock.
- **Direct Receipt Verification**: Checkout with Full Name, Phone, Complete Delivery Address, Courier selection (`J&T Express`, `Lalamove`), Payment Method selection (`GCash`, `Bank Transfer`), and compulsory receipt screenshot upload.
- **Password-Gated Admin View**:
  - Add products with custom title, price, initial stock, and photo upload.
  - Delete items or adjust inventory.
  - **"Reset for new batch"**: Purges products only with one click, preserving entire customer order history intact.
  - **CSV Export**: One-click download of all customer orders compatible with Google Sheets & Microsoft Excel.
  - Receipt preview lightbox to zoom into GCash/Bank reference numbers.

---

## Free-Tier Deployment Guide

The app is built to run effortlessly on free-tier providers:
- **Database & Cloud Storage**: [Supabase](https://supabase.com) (Free Tier: PostgreSQL + S3 Storage Bucket)
- **Application Hosting**: [Render](https://render.com), [Railway](https://railway.app), or [Vercel](https://vercel.com)

### 1. Set Up Free Supabase (Database + Storage)
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in Supabase and run the following schema:

```sql
-- Create Products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  price NUMERIC NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  courier TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  receipt_url TEXT NOT NULL,
  subtotal NUMERIC NOT NULL,
  shipping_fee NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  items_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

3. In Supabase, go to **Storage** and create a new bucket named:
   - Name: `order-now-assets`
   - Set to **Public** so photos and receipts can be viewed.
4. Copy your **Project URL** and **service_role secret key** from **Project Settings > API**.

---

### 2. Environment Variables Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set the values:

```env
PORT=3000
NODE_ENV=production

# Admin Passcode
ADMIN_PASSWORD=your_secure_password_here

# Store Defaults
DEFAULT_SHIPPING_FEE=100
STORE_NAME="My Brand - Batch Drop"
PAYMENT_INSTRUCTIONS="GCash: 0917-000-0000 (Account Name)\nBDO: 0012-3456-7890 (Account Name)"

# Supabase Free Tier Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
SUPABASE_STORAGE_BUCKET=order-now-assets

# Optional: Real-Time Google Sheets Sync Webhook
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
```

*(Note: When `SUPABASE_URL` is omitted in local development, the app automatically switches to built-in local SQLite and local disk storage in `public/uploads/` without requiring any cloud setup!)*

---

### Real-Time Google Sheets Integration Setup (Optional)
To stream every incoming customer order directly to a live Google Sheet in real time:
1. Open a new Google Sheet at [sheets.new](https://sheets.new).
2. Go to **Extensions > Apps Script**.
3. Copy and paste the code from [`google_sheets_script.js`](file:///c:/Users/Keith/Desktop/keith%20projects/ordering%20system/google_sheets_script.js).
4. Click **Deploy > New deployment**, select **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the generated Web App URL and add it to your `.env`:
   ```env
   GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
   ```
Every new order will now immediately appear in your Google Sheet with all item details, buyer info, location, and clickable receipt links.

---

### 3. Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm start
```

Visit:
- Customer View: `http://localhost:3000`
- Admin View: `http://localhost:3000#admin` (Default password: `admin123`)

---

### 4. Deploying to Render / Railway / Vercel

#### Deploying on Render (Free Web Service)
1. Push your repository to GitHub.
2. In Render dashboard, click **New > Web Service**.
3. Connect your repository.
4. Set:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. In **Environment Variables**, add the variables from your `.env` (including Supabase credentials and `ADMIN_PASSWORD`).
6. Click **Deploy Web Service**. You will receive your live link (e.g. `https://order-now.onrender.com`).

---

## Concurrency Safety Note
The order submission process utilizes atomic transactions (`sqliteDb.transaction` in local mode and transactional conditional updates in Supabase). If two customers attempt to purchase the remaining stock simultaneously, one will safely succeed and the second will receive an immediate out-of-stock notification with zero risk of negative inventory or overselling.
