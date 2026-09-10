-- =========================================================================
-- SUPABASE SCHEMA FOR ICONIC ORDERING SYSTEM / POS
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- =========================================================================

-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  category TEXT DEFAULT 'Cards',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- 2. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  courier TEXT NOT NULL DEFAULT 'Lalamove',
  payment_method TEXT NOT NULL DEFAULT 'GCash',
  receipt_url TEXT DEFAULT '',
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  shipping_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for Public / Publishable Key Access
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert products" ON public.products;
CREATE POLICY "Public insert products" ON public.products FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update products" ON public.products;
CREATE POLICY "Public update products" ON public.products FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete products" ON public.products;
CREATE POLICY "Public delete products" ON public.products FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public read orders" ON public.orders;
CREATE POLICY "Public read orders" ON public.orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
CREATE POLICY "Public insert orders" ON public.orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update orders" ON public.orders;
CREATE POLICY "Public update orders" ON public.orders FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete orders" ON public.orders;
CREATE POLICY "Public delete orders" ON public.orders FOR DELETE USING (true);

-- 5. Storage Bucket & Public Access Policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-now-assets', 'order-now-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public storage read" ON storage.objects;
CREATE POLICY "Public storage read" ON storage.objects FOR SELECT USING (bucket_id = 'order-now-assets');

DROP POLICY IF EXISTS "Public storage insert" ON storage.objects;
CREATE POLICY "Public storage insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'order-now-assets');

DROP POLICY IF EXISTS "Public storage update" ON storage.objects;
CREATE POLICY "Public storage update" ON storage.objects FOR UPDATE USING (bucket_id = 'order-now-assets');

DROP POLICY IF EXISTS "Public storage delete" ON storage.objects;
CREATE POLICY "Public storage delete" ON storage.objects FOR DELETE USING (bucket_id = 'order-now-assets');

-- 6. Admin Accounts Table (Stored dynamically in Supabase)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'main_admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read admin_users" ON public.admin_users;
CREATE POLICY "Public read admin_users" ON public.admin_users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert admin_users" ON public.admin_users;
CREATE POLICY "Public insert admin_users" ON public.admin_users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update admin_users" ON public.admin_users;
CREATE POLICY "Public update admin_users" ON public.admin_users FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete admin_users" ON public.admin_users;
CREATE POLICY "Public delete admin_users" ON public.admin_users FOR DELETE USING (true);

-- Insert Main Admin Account into Supabase
INSERT INTO public.admin_users (id, username, password, role)
VALUES ('admin_1', 'Main Admin', 'IconicAdmin2023', 'main_admin')
ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;

INSERT INTO public.admin_users (id, username, password, role)
VALUES ('admin_2', 'admin', 'IconicAdmin2023', 'main_admin')
ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;

-- =========================================================================
-- 7. RUN THIS CODE IN SUPABASE SQL EDITOR TO UPDATE EXISTING TABLES
-- (Dashboard -> SQL Editor -> New Query -> Paste & Click Run)
-- =========================================================================

-- 1. Ensure courier column has 'J&T Express' default
ALTER TABLE public.orders 
  ALTER COLUMN courier SET DEFAULT 'J&T Express';

-- 2. Ensure payment_method column has 'GCash' default
ALTER TABLE public.orders 
  ALTER COLUMN payment_method SET DEFAULT 'GCash';

-- 3. Update any past orders to match the new courier and payment options
UPDATE public.orders 
SET courier = 'J&T Express' 
WHERE courier IN ('Dine In', 'Takeout', 'Curbside', 'Delivery', '');

UPDATE public.orders 
SET payment_method = 'GCash' 
WHERE payment_method IN ('Cash', 'Cash at Counter', 'GCash / QRPh', 'Card', '');

-- 4. Set check constraint to strictly allow: 'GCash', 'PayPal', 'Bank'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('GCash', 'PayPal', 'Bank'));

-- =========================================================================
-- 8. CARD NUMBER INVENTORY SYSTEM (e.g. cards numbered 1-499 per print run)
-- RUN THIS ONCE IN SUPABASE SQL EDITOR before using card numbering.
-- Supersedes an earlier draft of this section (max_number/taken_numbers) —
-- if you ran that draft, it's harmless to leave those two unused columns in
-- place; this feature no longer reads or writes them.
-- =========================================================================

-- 8.1 Card-numbering configuration + denormalized counters on products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS card_numbering_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS card_number_start INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS card_number_end INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS card_available_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS card_pending_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS card_sold_count INTEGER NOT NULL DEFAULT 0;

-- 8.2 The card ledger itself — one row per physical card number.
-- Never bulk-deleted on product edits; sold/pending rows carry order history.
CREATE TABLE IF NOT EXISTS public.product_cards (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  card_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'PENDING_PAYMENT', 'SOLD_OUT', 'DISABLED')),
  price NUMERIC(10, 2),
  pending_order_id TEXT,
  sold_order_id TEXT,
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, card_number)
);

-- In case product_cards already existed from an earlier run without pricing
ALTER TABLE public.product_cards ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_product_cards_product_status ON public.product_cards (product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_cards_card_number ON public.product_cards (product_id, card_number);

ALTER TABLE public.product_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read product_cards" ON public.product_cards;
CREATE POLICY "Public read product_cards" ON public.product_cards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert product_cards" ON public.product_cards;
CREATE POLICY "Public insert product_cards" ON public.product_cards FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update product_cards" ON public.product_cards;
CREATE POLICY "Public update product_cards" ON public.product_cards FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete product_cards" ON public.product_cards;
CREATE POLICY "Public delete product_cards" ON public.product_cards FOR DELETE USING (true);

-- 8.3 Payment-verification fields on orders (manual admin "Mark as Paid" workflow)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 8.4 Multi-photo gallery per product (image_url stays as the cover/first photo)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

