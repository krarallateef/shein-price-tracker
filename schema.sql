-- متتبّع أسعار شي إن — مخطّط D1. طبّقه:
--   wrangler d1 execute shein-tracker-db --remote --file schema.sql

CREATE TABLE IF NOT EXISTS products (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  url                  TEXT NOT NULL,
  goods_id             TEXT,                 -- معرّف المنتج في شي إن (يُستخرج تلقائياً)
  label                TEXT,                 -- تسمية من اختيارك
  image_url            TEXT,                 -- الصورة الرئيسية (تُملأ عند أول فحص)
  sku                  TEXT,                 -- رمز المنتج (goods_sn)
  region               TEXT DEFAULT 'www',   -- www | ar | m ... (نطاق شي إن الفرعي)
  currency             TEXT,                 -- تُملأ من JSON-LD عند أول فحص
  target_price         REAL,                 -- اختياري: نبّهني إذا نزل تحت هذا
  notify_channel       TEXT DEFAULT 'telegram', -- telegram | email | both
  active               INTEGER NOT NULL DEFAULT 1,
  last_price           REAL,
  last_in_stock        INTEGER,
  last_checked_at      TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error           TEXT,
  created_at           TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_due ON products (active, last_checked_at);

-- سجلّ التغيّرات — صف واحد لكل تغيّر مكتشَف (لا لكل فحص).
CREATE TABLE IF NOT EXISTS price_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_price    REAL,
  new_price    REAL,
  pct_change   REAL,
  in_stock     INTEGER,
  event_type   TEXT NOT NULL,   -- price_drop | price_rise | back_in_stock | out_of_stock | target_hit
  detected_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_product ON price_events (product_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_time ON price_events (detected_at DESC);

-- إعدادات عامة (توكن تلغرام، مفتاح Resend، القناة الافتراضية...).
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
