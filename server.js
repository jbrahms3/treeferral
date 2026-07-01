require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { createClerkClient } = require('@clerk/backend');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── AUTH MIDDLEWARE ──
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = await clerkClient.verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── GET /api/services ──
// Returns all services, each with one randomly-selected active code
app.get('/api/services', async (req, res) => {
  try {
    const { rows: services } = await pool.query('SELECT * FROM services ORDER BY name');

    const result = await Promise.all(services.map(async (svc) => {
      const { rows: picked } = await pool.query(`
        SELECT c.code, u.name AS contributor, u.trees AS contributor_trees
        FROM codes c
        JOIN users u ON c.user_id = u.clerk_user_id
        WHERE c.service_id = $1 AND c.active = true
        ORDER BY RANDOM() LIMIT 1
      `, [svc.id]);

      const { rows: [{ count }] } = await pool.query(
        'SELECT COUNT(*) FROM codes WHERE service_id = $1 AND active = true', [svc.id]
      );

      return {
        ...svc,
        code: picked[0]?.code || null,
        contributor: picked[0]?.contributor || null,
        contributor_trees: picked[0]?.contributor_trees || 0,
        code_count: parseInt(count),
      };
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /api/services', err);
    res.status(500).json({ error: 'DB error' });
  }
});

// ── GET /api/stats ──
app.get('/api/stats', async (req, res) => {
  try {
    const [{ rows: [m] }, { rows: [t] }, { rows: [c] }, { rows: [s] }] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COALESCE(SUM(trees), 0) AS total FROM users'),
      pool.query('SELECT COUNT(*) FROM codes WHERE active = true'),
      pool.query('SELECT COUNT(*) FROM services'),
    ]);
    res.json({
      members: parseInt(m.count),
      trees: parseInt(t.total),
      codes: parseInt(c.count),
      services: parseInt(s.count),
    });
  } catch (err) {
    console.error('GET /api/stats', err);
    res.status(500).json({ error: 'DB error' });
  }
});

// ── GET /api/user ──
app.get('/api/user', requireAuth, async (req, res) => {
  try {
    let { rows: [user] } = await pool.query(
      'SELECT * FROM users WHERE clerk_user_id = $1', [req.userId]
    );

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(req.userId);
      const name = clerkUser.firstName
        || clerkUser.emailAddresses?.[0]?.emailAddress?.split('@')[0]
        || 'Member';
      await pool.query(
        'INSERT INTO users (clerk_user_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.userId, name]
      );
      ({ rows: [user] } = await pool.query(
        'SELECT * FROM users WHERE clerk_user_id = $1', [req.userId]
      ));
    }

    const { rows: codes } = await pool.query(`
      SELECT c.service_id, c.code, s.name AS service_name, s.domain
      FROM codes c
      JOIN services s ON c.service_id = s.id
      WHERE c.user_id = $1 AND c.active = true
      ORDER BY c.created_at DESC
    `, [req.userId]);

    res.json({ ...user, codes });
  } catch (err) {
    console.error('GET /api/user', err);
    res.status(500).json({ error: 'DB error' });
  }
});

// ── POST /api/user/codes ──
// Add or update a code. Creates the service if it doesn't exist.
app.post('/api/user/codes', requireAuth, async (req, res) => {
  const { domain, name, code, reward, serviceId: knownId } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

  try {
    // Ensure user row exists
    const clerkUser = await clerkClient.users.getUser(req.userId);
    const userName = clerkUser.firstName
      || clerkUser.emailAddresses?.[0]?.emailAddress?.split('@')[0]
      || 'Member';
    await pool.query(
      'INSERT INTO users (clerk_user_id, name) VALUES ($1, $2) ON CONFLICT (clerk_user_id) DO UPDATE SET name = $2',
      [req.userId, userName]
    );

    let serviceId = knownId;

    if (!serviceId) {
      if (!domain) return res.status(400).json({ error: 'domain or serviceId required' });
      const { rows: [existing] } = await pool.query(
        'SELECT id FROM services WHERE domain = $1', [domain]
      );
      if (existing) {
        serviceId = existing.id;
        if (name || reward) {
          await pool.query(
            'UPDATE services SET name = COALESCE($1, name), reward = COALESCE($2, reward) WHERE id = $3',
            [name || null, reward || null, serviceId]
          );
        }
      } else {
        serviceId = domain.replace(/\./g, '_');
        await pool.query(
          `INSERT INTO services (id, name, category, domain, bg, reward, url)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
          [
            serviceId,
            name || domain,
            'Other',
            domain,
            '#f5f5f5',
            reward || 'Referral bonus — see site for details',
            'https://' + domain,
          ]
        );
      }
    }

    await pool.query(
      `INSERT INTO codes (service_id, user_id, code)
       VALUES ($1, $2, $3)
       ON CONFLICT (service_id, user_id) DO UPDATE SET code = $3, active = true`,
      [serviceId, req.userId, code.toUpperCase()]
    );

    res.json({ ok: true, serviceId });
  } catch (err) {
    console.error('POST /api/user/codes', err);
    res.status(500).json({ error: 'DB error' });
  }
});

// ── DELETE /api/user/codes/:serviceId ──
app.delete('/api/user/codes/:serviceId', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE codes SET active = false WHERE service_id = $1 AND user_id = $2',
      [req.params.serviceId, req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/user/codes', err);
    res.status(500).json({ error: 'DB error' });
  }
});

// ── POST /api/user/plan ──
app.post('/api/user/plan', requireAuth, async (req, res) => {
  const { plan, trees } = req.body;
  if (!plan) return res.status(400).json({ error: 'plan required' });
  try {
    await pool.query(
      'UPDATE users SET plan = $1, trees = trees + $2 WHERE clerk_user_id = $3',
      [plan, trees || 0, req.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/user/plan', err);
    res.status(500).json({ error: 'DB error' });
  }
});

// ── HEALTH CHECK ──
app.get('/health', (req, res) => res.json({ ok: true }));

// ── SPA FALLBACK ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── START ──
async function start() {
  if (!process.env.CLERK_SECRET_KEY) {
    console.error('⚠️  CLERK_SECRET_KEY is not set — all authenticated routes will return 401');
  }
  if (!process.env.DATABASE_URL) {
    console.error('⚠️  DATABASE_URL is not set — all DB calls will fail');
  }
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('DB schema ready');
  } catch (err) {
    console.error('DB schema error:', err.message);
  }
  app.listen(PORT, () => console.log(`Treeferral running on :${PORT}`));
}

start();
