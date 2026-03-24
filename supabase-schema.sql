-- =====================================================
-- DENNYANGELOW.COM — ПЪЛНА БАЗА ДАННИ
-- Изпълни в Supabase SQL Editor
-- =====================================================

-- LEADS (имейл абонати от наръчника)
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  source TEXT DEFAULT 'naruchnik', -- naruchnik | facebook | tiktok | direct
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ip_address TEXT,
  subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ПРОДУКТИ (само Atlas Terra се управлява директно)
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_price DECIMAL(10,2), -- old/crossed-out price
  unit TEXT DEFAULT 'бр.',     -- бр. / кг / л
  stock INTEGER DEFAULT 999,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ПОРЪЧКИ (само за Atlas Terra продуктите)
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL, -- DA-2024-001
  
  -- Клиент
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT NOT NULL,
  customer_city TEXT NOT NULL,
  customer_notes TEXT,
  
  -- Плащане
  payment_method TEXT DEFAULT 'cod', -- cod | bank | card
  payment_status TEXT DEFAULT 'pending', -- pending | paid | refunded
  
  -- Статус
  status TEXT DEFAULT 'new', -- new | confirmed | shipped | delivered | cancelled
  
  -- Стойности
  subtotal DECIMAL(10,2) NOT NULL,
  shipping DECIMAL(10,2) DEFAULT 5.99,
  total DECIMAL(10,2) NOT NULL,
  
  -- Tracking
  utm_source TEXT,
  utm_campaign TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- ПОРЪЧАНИ ПРОДУКТИ
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL
);

-- АФИЛИЕЙТ КЛИКОВЕ
CREATE TABLE affiliate_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner TEXT NOT NULL, -- agroapteki | oranjeriata | atlasagro
  product_slug TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EMAIL КАМПАНИИ LOG
CREATE TABLE email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  email_type TEXT NOT NULL, -- welcome | followup_1 | followup_2 | seasonal | order_confirm
  status TEXT DEFAULT 'sent', -- sent | opened | clicked | bounced
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- НАСТРОЙКИ НА САЙТА
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- НАЧАЛНИ ДАННИ
-- =====================================================

-- Atlas Terra продукти
INSERT INTO products (slug, name, description, price, compare_price, unit, image_url, sort_order) VALUES
(
  'atlas-terra',
  'Atlas Terra — Органичен подобрител на почвата',
  'Богат на хуминови киселини и органично вещество. Трансформира структурата на почвата, задържа влага и хранителни елементи. Идеален за изтощени почви.',
  28.90,
  35.00,
  'кг',
  '/images/atlas-terra.webp',
  1
),
(
  'atlas-terra-amino',
  'Atlas Terra AMINO — Аминокиселини за експлозивен растеж',
  'Висока концентрация свободни аминокиселини. Действа моментално при стрес — жега, студ, пресаждане. Видими резултати след 48 часа.',
  32.90,
  39.00,
  'л',
  '/images/atlas-terra-amino.webp',
  2
);

-- Настройки
INSERT INTO settings (key, value) VALUES
('site_phone', '+359 88 888 8888'),
('site_email', 'support@dennyangelow.com'),
('shipping_price', '5.99'),
('free_shipping_above', '60'),
('admin_email', 'denny@dennyangelow.com'),
('whatsapp_number', '359888888888');

-- =====================================================
-- ИНДЕКСИ ЗА БЪРЗИНА
-- =====================================================
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_affiliate_partner ON affiliate_clicks(partner, created_at DESC);

-- =====================================================
-- АВТОМАТИЧЕН НОМЕР НА ПОРЪЧКА
-- =====================================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  year TEXT := to_char(NOW(), 'YYYY');
  seq INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO seq FROM orders
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  NEW.order_number := 'DA-' || year || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Автоматичен updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Публично може да INSERT поръчки и leads
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create leads" ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can log affiliate clicks" ON affiliate_clicks FOR INSERT WITH CHECK (true);

-- Само authenticated (admin) може да SELECT/UPDATE/DELETE
CREATE POLICY "Admin reads orders" ON orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin updates orders" ON orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin reads leads" ON leads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin reads clicks" ON affiliate_clicks FOR SELECT USING (auth.role() = 'authenticated');

-- Продуктите са публично четими
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are public" ON products FOR SELECT USING (active = true);
CREATE POLICY "Admin manages products" ON products FOR ALL USING (auth.role() = 'authenticated');
