import { businessDefaults } from '../shared/business.mjs';
import { AppError, openStore } from './database.mjs';

async function body(req) {
  if (!req.headers['content-type']?.includes('application/json')) throw new AppError('Expected a JSON request.', 415);
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new AppError('The request is too large.', 413);
    chunks.push(chunk);
  }
  try { const data = JSON.parse(Buffer.concat(chunks).toString()); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data; }
  catch { throw new AppError('Enter valid request details.'); }
}
export function createApi({ store = openStore(), secureCookies = process.env.COOKIE_SECURE === 'true' } = {}) {
  const attempts = new Map();
  const cookie = (value, maxAge = 604800) => `perfume_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;
  return async function api(req, res, next) {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.startsWith('/api/')) return next ? next() : false;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (data, status = 200) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    try {
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin) {
        if (new URL(req.headers.origin).host !== req.headers.host) throw new AppError('This request must come from your workspace.', 403);
      }
      if (req.method === 'GET' && path === '/api/branding') {
        const business = store.get('settings', 'business') || businessDefaults;
        return send({ name: business.name, logo: business.logo });
      }
      if (req.method === 'GET' && path === '/api/manifest.webmanifest') {
        const name = store.get('settings', 'business')?.name || 'Perfume Manager';
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        return send({ id: '/', name, short_name: name, description: `${name} inventory, sales, customers, and business workspace.`, lang: 'en', start_url: '/', scope: '/', display: 'standalone', background_color: '#f8f7f4', theme_color: '#673b50', icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ] });
      }
      const token = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('perfume_session='))?.slice('perfume_session='.length);
      const user = store.sessionUser(token);
      if (path === '/api/session' && req.method === 'GET') return send({ user, setupRequired: !store.hasOwner() });
      if (['/api/login', '/api/setup'].includes(path) && req.method === 'POST') {
        const key = req.socket.remoteAddress || 'local';
        const previous = attempts.get(key);
        const limit = previous && previous.until > Date.now() ? previous : { count: 0, until: Date.now() + 60000 };
        attempts.set(key, limit);
        if (limit.count >= 10) throw new AppError('Too many attempts. Please try again in a minute.', 429);
        limit.count++;
        const data = await body(req);
        const account = path === '/api/setup' ? store.createOwner(data) : store.authenticate(data.email, data.password);
        attempts.delete(key);
        store.deleteSession(token);
        res.setHeader('Set-Cookie', cookie(store.createSession(account.id)));
        return send({ user: account, setupRequired: false }, path === '/api/setup' ? 201 : 200);
      }
      if (!user) throw new AppError('Sign in to access your workspace.', 401);
      if (path === '/api/logout' && req.method === 'POST') {
        store.deleteSession(token); res.setHeader('Set-Cookie', cookie('', 0)); return send({ user: null, setupRequired: false });
      }
      if (path === '/api/password' && req.method === 'POST') {
        const data = await body(req);
        store.changePassword(user.id, data.currentPassword, data.password);
        res.setHeader('Set-Cookie', cookie(store.createSession(user.id))); return send({ ok: true });
      }
      if (path === '/api/backup' && req.method === 'GET') return send(store.backup());
      if (path === '/api/sales' && req.method === 'POST') return send(store.createSale(await body(req)), 201);
      const refund = path.match(/^\/api\/sales\/([^/]+)\/refunds(?:\/([^/]+))?$/);
      if (refund && req.method === 'POST') return send(refund[2] ? store.resolveRefund(refund[1], refund[2], await body(req)) : store.initiateRefund(refund[1], await body(req)));
      const sale = path.match(/^\/api\/sales\/([^/]+)\/(cancel|payment)$/);
      if (sale && req.method === 'POST') return send(sale[2] === 'cancel' ? store.cancelSale(sale[1]) : store.addPayment(sale[1], (await body(req)).amount));
      const stock = path.match(/^\/api\/products\/([^/]+)\/stock$/);
      if (stock && req.method === 'POST') { const data = await body(req); return send(store.changeStock(stock[1], data.mode, data.amount)); }
      const records = path.match(/^\/api\/records\/([a-zA-Z]+)(?:\/([^/]+))?$/);
      if (records) {
        const [, collection, id] = records;
        if (req.method === 'GET') {
          if (!id) return send(store.list(collection));
          // Validate collection names even when reading a single record.
          store.list(collection);
          return send(store.get(collection, id));
        }
        if (req.method === 'POST' && !id) return send(store.create(collection, await body(req)), 201);
        if (req.method === 'PATCH' && id) return send(store.update(collection, id, await body(req)));
        if (req.method === 'PUT' && collection === 'settings' && id === 'business') return send(store.saveSettings(await body(req)));
        if (req.method === 'DELETE' && collection === 'expenses' && id) { store.deleteExpense(id); return send({ ok: true }); }
      }
      throw new AppError('Endpoint not found.', 404);
    } catch (error) {
      if (!(error instanceof AppError)) console.error('SQLite API error:', error);
      if (!res.headersSent) send({ error: error instanceof AppError ? error.message : 'Something went wrong saving your data. Please try again.' }, error.status || 500);
      else res.end();
    }
  };
}
