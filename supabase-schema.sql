-- =====================================================
-- DENNYANGELOW.COM — ПЪЛНА БАЗА ДАННИ v2
-- Изпълни в Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  source TEXT DEFAULT 'naruchnik',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ip_address TEXT,
  subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_price DECIMAL(10,2),
  unit TEXT DEFAULT 'бр.',
  stock INTEGER DEFAULT 999,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT NOT NULL,
  customer_city TEXT NOT NULL,
  customer_notes TEXT,
  payment_method TEXT DEFAULT 'cod',
  payment_status TEXT DEFAULT 'pending',
  status TEXT DEFAULT 'new',
  subtotal DECIMAL(10,2) NOT NULL,
  shipping DECIMAL(10,2) DEFAULT 5.99,
  total DECIMAL(10,2) NOT NULL,
  utm_source TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner TEXT NOT NULL,
  product_slug TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  email_type TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Начални данни
INSERT INTO products (slug, name, description, price, compare_price, unit, image_url, sort_order)
VALUES
  ('atlas-terra', 'Atlas Terra — Органичен подобрител на почвата', 'Богат на хуминови киселини и органично вещество.', 28.90, 35.00, 'кг', '/images/atlas-terra.webp', 1),
  ('atlas-terra-amino', 'Atlas Terra AMINO — Аминокиселини за експлозивен растеж', 'Висока концентрация свободни аминокиселини.', 32.90, 39.00, 'л', '/images/atlas-terra-amino.webp', 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO settings (key, value) VALUES
  ('site_phone', '+359 88 888 8888'),
  ('site_email', 'support@dennyangelow.com'),
  ('shipping_price', '5.99'),
  ('free_shipping_above', '60'),
  ('admin_email', 'denny@dennyangelow.com'),
  ('whatsapp_number', '359888888888')
ON CONFLICT (key) DO NOTHING;

-- Индекси
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email    ON leads(email);
CREATE INDEX IF NOT EXISTS idx_affiliate_partner ON affiliate_clicks(partner, created_at DESC);

-- Автоматичен номер на поръчка
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  year TEXT := to_char(NOW(), 'YYYY');
  seq  INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO seq FROM orders
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  NEW.order_number := 'DA-' || year || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_order_number ON orders;
CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create orders"        ON orders;
DROP POLICY IF EXISTS "Anyone can create leads"         ON leads;
DROP POLICY IF EXISTS "Anyone can log affiliate clicks" ON affiliate_clicks;
DROP POLICY IF EXISTS "Admin reads orders"              ON orders;
DROP POLICY IF EXISTS "Admin updates orders"            ON orders;
DROP POLICY IF EXISTS "Admin reads leads"               ON leads;
DROP POLICY IF EXISTS "Admin reads clicks"              ON affiliate_clicks;
DROP POLICY IF EXISTS "Products are public"             ON products;
DROP POLICY IF EXISTS "Admin manages products"          ON products;

CREATE POLICY "Anyone can create orders"        ON orders           FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create leads"         ON leads            FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can log affiliate clicks" ON affiliate_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin reads orders"              ON orders           FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin updates orders"            ON orders           FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin reads leads"               ON leads            FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin reads clicks"              ON affiliate_clicks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Products are public"             ON products         FOR SELECT USING (active = true);
CREATE POLICY "Admin manages products"          ON products         FOR ALL    USING (auth.role() = 'authenticated');
