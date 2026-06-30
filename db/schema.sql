CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  name          TEXT,
  plan          TEXT DEFAULT NULL,
  trees         INTEGER DEFAULT 0,
  joined_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'Other',
  domain     TEXT NOT NULL,
  bg         TEXT DEFAULT '#f5f5f5',
  reward     TEXT,
  url        TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS codes (
  id         SERIAL PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, user_id)
);

-- Seed the 12 default services (idempotent)
INSERT INTO services (id, name, category, domain, bg, reward, url) VALUES
  ('robinhood',  'Robinhood',  'Finance',      'robinhood.com',   '#e6fff0', 'Get a free stock (up to $225) when you sign up',      'https://robinhood.com'),
  ('coinbase',   'Coinbase',   'Crypto',       'coinbase.com',    '#eef2ff', '$10 in Bitcoin when you buy or sell $100+',           'https://coinbase.com'),
  ('doordash',   'DoorDash',   'Food Delivery','doordash.com',    '#fff1f0', '50% off your first 3 orders (up to $15 each)',        'https://doordash.com'),
  ('uber',       'Uber',       'Rides',        'uber.com',        '#f5f5f5', '$20 off your first 2 rides',                         'https://uber.com'),
  ('airbnb',     'Airbnb',     'Travel',       'airbnb.com',      '#fff1f3', '$50 off your first booking of $150+',                'https://airbnb.com'),
  ('chime',      'Chime',      'Finance',      'chime.com',       '#f0fdf4', '$100 bonus when you set up direct deposit',           'https://chime.com'),
  ('rakuten',    'Rakuten',    'Shopping',     'rakuten.com',     '#fff5f5', '$30 cash back on your first $30+ purchase',           'https://rakuten.com'),
  ('hinge',      'Hinge',      'Dating',       'hinge.co',        '#fff0f6', '1 month of Hinge+ free',                             'https://hinge.co'),
  ('sofi',       'SoFi',       'Finance',      'sofi.com',        '#f5f0ff', 'Up to $325 bonus when you open an account',           'https://sofi.com'),
  ('acorns',     'Acorns',     'Investing',    'acorns.com',      '#f0fdf4', '$5 bonus when you start investing',                  'https://acorns.com'),
  ('expensify',  'Expensify',  'Business',     'expensify.com',   '#eff8ff', '3 months free on any paid plan',                    'https://expensify.com'),
  ('honey',      'Honey',      'Shopping',     'joinhoney.com',   '#fffbeb', '500 bonus Honey Gold on first order',                'https://joinhoney.com')
ON CONFLICT (id) DO NOTHING;
