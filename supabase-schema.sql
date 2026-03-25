-- =====================================================
-- DENNYANGELOW.COM — ПЪЛНА БАЗА ДАННИ v3
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

-- Афилиейт продукти — управляват се от Admin панела
CREATE TABLE IF NOT EXISTS affiliate_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  bullets TEXT[] DEFAULT '{}',
  image_url TEXT,
  affiliate_url TEXT NOT NULL,
  partner TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  emoji TEXT DEFAULT '🌿',
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Категорийни линкове (бързите линкове) — управляват се от Admin
CREATE TABLE IF NOT EXISTS category_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  emoji TEXT DEFAULT '🌱',
  partner TEXT,
  slug TEXT UNIQUE NOT NULL,
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

-- =====================================================
-- НАЧАЛНИ ДАННИ
-- =====================================================

INSERT INTO products (slug, name, description, price, compare_price, unit, image_url, sort_order)
VALUES
  ('atlas-terra', 'Atlas Terra', 'Органичен подобрител за почвата. Богат на хуминови киселини и органично вещество.', 28.90, 35.00, 'кг', 'https://d1yei2z3i6k35z.cloudfront.net/4263526/69b106e276e0e_Jan-2025-ATLAS-TERRA-AMINONITRO.jpg', 1),
  ('atlas-terra-amino', 'Atlas Terra AMINO', 'Аминокиселини за експлозивен растеж. Висока концентрация свободни аминокиселини.', 32.90, 39.00, 'л', 'https://d1yei2z3i6k35z.cloudfront.net/4263526/69b106e276e0e_Jan-2025-ATLAS-TERRA-AMINONITRO.jpg', 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO affiliate_products (slug, name, subtitle, description, bullets, image_url, affiliate_url, partner, emoji, sort_order)
VALUES
  ('kristalon', 'Кристалон Зелен 18-18-18', '⭐ Един от най-използваните торове от фермерите',
   'Водоразтворимият NPK тор с микроелементи, който стимулира бърз растеж, силна коренова система и по-голям добив. Осигурява идеално съотношение на азот, фосфор и калий.',
   ARRAY['100% водоразтворим', 'Съдържа микроелементи', 'Подходящ за листно торене и фертигация', 'Увеличава добива и качеството на плодовете'],
   'https://d1yei2z3i6k35z.cloudfront.net/4263526/69b0fc97106ef_zelen-kristalon-230x400.webp',
   'https://agroapteki.com/torove/npk-npk-torove/kristalon-zelen-specialen-18-18-18-kompleksen-tor/?tracking=6809eceee15ad',
   'agroapteki', '💎', 1),

  ('kaliteh', 'Калитех', '⭐ Предпазва доматите от върхово гниене',
   'Мощен калциев биостимулатор, който доставя лесно усвоим калций на растенията и предотвратява върхово гниене при доматите и пипера.',
   ARRAY['Предпазва от върхово гниене', 'Подобрява качеството и цвета на плодовете', 'Увеличава добива и съдържанието на захари', 'Повишава устойчивостта към суша и стрес', 'Подходящ за листно пръскане и капково напояване'],
   'https://d1yei2z3i6k35z.cloudfront.net/4263526/69b1000d9fb83_kaliteh-224x400.webp',
   'https://agroapteki.com/torove/biostimulatori/kaliteh/?tracking=6809eceee15ad',
   'agroapteki', '🛡️', 2),

  ('amalgerol', 'Амалгерол', '⭐ Легендарният стимулатор за всяка култура',
   '100% природен продукт, съчетаващ силата на алпийски билки и морски водорасли. Действа като щит срещу стреса при градушки, суша или студ.',
   ARRAY['Мощен анти-стрес ефект (слана, суша, хербициди)', 'Ускорява разграждането на растителните остатъци', 'Подобрява приема на азот и структурата на почвата', '100% биоразградим, сертифициран за био земеделие', 'Действа като естествен прилепител за препарати'],
   'https://d1yei2z3i6k35z.cloudfront.net/4263526/69b11176b1758_amalgerol-300x400.webp',
   'https://agroapteki.com/torove/techni-torove/amalgerol-za-uskoryavane-rasteja-na-kulturite/?tracking=6809eceee15ad',
   'agroapteki', '🌿', 3),

  ('sineis', 'Синейс 480 СК', '⭐ Мощна био-защита срещу трипс и миниращ молец',
   'Революционен биологичен продукт, базиран на естествения спинозад. Спира атаките на колорадския бръмбар, трипса и миниращия молец само за часове. Изключително кратък карантинен срок — само 3 дни за домати!',
   ARRAY['Ефективен срещу Калифорнийски трипс', 'Безмилостен към Доматения миниращ молец (Tuta absoluta)', 'Изключително кратък карантинен срок (3 до 7 дни)', 'Устойчив на отмиване дори при дъжд', 'Подходящ за биологично земеделие'],
   'https://d1yei2z3i6k35z.cloudfront.net/4263526/69b4f5319cf6f1.51072214_sineis-20-237x400.webp',
   'https://agroapteki.com/preparati/insekticidi/sineis-480-sk/?tracking=6809eceee15ad',
   'agroapteki', '🐛', 4),

  ('ridomil', 'Ридомил Голд Р ВГ', '⭐ Стопира маната само за 48 часа',
   'Легендарен фунгицид, който не само предпазва, но и лекува вече възникнала зараза. Прониква в растението само за 30 минути и предпазва дори новите листа. Незаменим при влажно време.',
   ARRAY['Спира развитието на болестта до 2 дни след заразата', 'Комбинирано контактно, системно и лечебно действие', 'Дъждът не го отмива (абсорбира се за 30 минути)', 'Предпазва новия прираст между две третирания', 'Лесна разтворимост без разпрашаване'],
   'https://d1yei2z3i6k35z.cloudfront.net/4263526/69b4f6e3264510.81149458_ridomil-gold-300x400.webp',
   'https://agroapteki.com/preparati/fungicidi/ridomil-gold/?tracking=6809eceee15ad',
   'agroapteki', '🍄', 5),

  ('turbo-root', 'Турбо Рут', '⭐ Мощно вкореняване и 100% прихващане',
   'Тайното оръжие на всеки градинар при засаждане. Формулата стимулира растежа на фините бели корени. Комбинацията от хуминови киселини и желязо осигурява експлозивен ранен старт.',
   ARRAY['Гарантира бързо вкореняване на младия разсад', 'Подобрява структурата на почвата около корена', 'Съдържа готови аминокиселини за бързо усвояване', 'Увеличава приема на фосфор, калий и микроелементи', 'Повишава устойчивостта на младите растения към стрес'],
   'https://d1yei2z3i6k35z.cloudfront.net/4263526/69b4fd32592803.63113743_turbo-rot-224x400.webp',
   'https://agroapteki.com/torove/biostimulatori/turbo-rut/?tracking=6809eceee15ad',
   'agroapteki', '🌱', 6),

  ('ginegar-folio', 'Израелски Найлон GINEGAR', '⭐ Световен стандарт за оранжерии',
   'Премиум оранжерийни фолиа от GINEGAR Israel — сред най-добрите в света за професионално производство. Многослойна технология, по-дълъг живот, по-стабилни свойства.',
   ARRAY['Многослойна технология (до 9 слоя)', 'UV защита и анти-капков ефект', 'По-добър контрол на температурата и влагата', 'По-здрави растения и по-стабилен добив', 'Дългосрочна инвестиция — не се сменя всяка година'],
   'https://d1yei2z3i6k35z.cloudfront.net/4263526/6940e17e0d4a3_pe-film-supflor-ginegar.jpg',
   'https://oranjeriata.com/products/polietilen-za-oranjerii/izraelski-polietiolen-za-oranjerii/ginegar',
   'oranjeriata', '🏕️', 7),

  ('agril-textil', 'Агрил — Израелски Агротекстил', '⭐ Надеждна защита от слана и студ',
   'Висококачествен тъкан агротекстил за надеждна защита на разсади и култури от слана, студ и вятър. Произведен от GINEGAR Israel.',
   ARRAY['Защита от слана и студ', 'Позволява преминаването на въздух и вода', 'Лек и лесен за работа', 'Подходящ за разсади и деликатни култури', 'Дълготраен и устойчив материал'],
   'https://d1yei2z3i6k35z.cloudfront.net/4263526/694242e9c1baa_ginegar-logo-mk-group.600x600.png',
   'https://oranjeriata.com/products/aksesoari-za-otglejdane-na-rasteniya/netukan-tekstil---agril',
   'oranjeriata', '🧵', 8)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO category_links (slug, label, href, emoji, partner, sort_order)
VALUES
  ('torove', '🌱 Торове и Био Стимулатори', 'https://agroapteki.com/torove/?tracking=6809eceee15ad', '🌱', 'agroapteki', 1),
  ('polivni', '💧 Изграждане на Поливни Системи', 'https://agroapteki.com/polivni-sistemi/?tracking=6809eceee15ad', '💧', 'agroapteki', 2),
  ('preparati', '🛡️ Защита от Болести и Вредители', 'https://agroapteki.com/preparati/?tracking=6809eceee15ad', '🛡️', 'agroapteki', 3),
  ('bio', '🌳 Биологично Земеделие', '#', '🌳', NULL, 4),
  ('semena', '🌾 Качествени Семена за Вкусна Реколта', 'https://agroapteki.com/semena/?tracking=6809eceee15ad', '🌾', 'agroapteki', 5),
  ('najlon', '🏕️ Израелски Найлон за Оранжерия', 'https://oranjeriata.com/products/aksesoari-za-otglejdane-na-rasteniya/netukan-tekstil---agril', '🏕️', 'oranjeriata', 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO settings (key, value) VALUES
  ('site_phone', '+359 88 888 8888'),
  ('site_email', 'support@dennyangelow.com'),
  ('shipping_price', '5.99'),
  ('free_shipping_above', '60'),
  ('admin_email', 'denny@dennyangelow.com'),
  ('whatsapp_number', '359888888888'),
  ('hero_title', 'Искаш едри, здрави и сочни домати?'),
  ('hero_subtitle', 'Без болести, без гниене и без загубена реколта. С правилната грижа и нужните продукти можеш да отгледаш здрави и продуктивни растения, без излишни усилия.'),
  ('hero_warning', 'Не рискувай да изхвърлиш продукцията си, само защото нямаш нужната информация навреме.')
ON CONFLICT (key) DO NOTHING;

-- Индекси
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email    ON leads(email);
CREATE INDEX IF NOT EXISTS idx_affiliate_partner ON affiliate_clicks(partner, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_active ON affiliate_products(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_category_links_active ON category_links(active, sort_order);

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

DROP TRIGGER IF EXISTS affiliate_products_updated_at ON affiliate_products;
CREATE TRIGGER affiliate_products_updated_at
  BEFORE UPDATE ON affiliate_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create orders"        ON orders;
DROP POLICY IF EXISTS "Anyone can create leads"         ON leads;
DROP POLICY IF EXISTS "Anyone can log affiliate clicks" ON affiliate_clicks;
DROP POLICY IF EXISTS "Admin reads orders"              ON orders;
DROP POLICY IF EXISTS "Admin updates orders"            ON orders;
DROP POLICY IF EXISTS "Admin reads leads"               ON leads;
DROP POLICY IF EXISTS "Admin reads clicks"              ON affiliate_clicks;
DROP POLICY IF EXISTS "Products are public"             ON products;
DROP POLICY IF EXISTS "Admin manages products"          ON products;
DROP POLICY IF EXISTS "Affiliate products are public"   ON affiliate_products;
DROP POLICY IF EXISTS "Admin manages affiliate products" ON affiliate_products;
DROP POLICY IF EXISTS "Category links are public"       ON category_links;
DROP POLICY IF EXISTS "Admin manages category links"    ON category_links;
DROP POLICY IF EXISTS "Settings are public"             ON settings;
DROP POLICY IF EXISTS "Admin manages settings"          ON settings;

CREATE POLICY "Anyone can create orders"        ON orders           FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create leads"         ON leads            FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can log affiliate clicks" ON affiliate_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin reads orders"              ON orders           FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin updates orders"            ON orders           FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin reads leads"               ON leads            FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin reads clicks"              ON affiliate_clicks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Products are public"             ON products         FOR SELECT USING (active = true);
CREATE POLICY "Admin manages products"          ON products         FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "Affiliate products are public"   ON affiliate_products FOR SELECT USING (active = true);
CREATE POLICY "Admin manages affiliate products" ON affiliate_products FOR ALL  USING (auth.role() = 'authenticated');
CREATE POLICY "Category links are public"       ON category_links   FOR SELECT USING (active = true);
CREATE POLICY "Admin manages category links"    ON category_links   FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "Settings are public"             ON settings         FOR SELECT USING (true);
CREATE POLICY "Admin manages settings"          ON settings         FOR ALL    USING (auth.role() = 'authenticated');
