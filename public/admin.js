import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';
const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.SESSION_SECRET || '';
const sign = exp => crypto.createHmac('sha256', SECRET).update('admin.' + exp).digest('hex');
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const h = s => crypto.createHash('sha256').update(String(s)).digest();
function authed(req) {
  const m = /(?:^|; )admin=(\d+)\.([0-9a-f]+)/.exec(req.headers.cookie || '');
  return !!(SECRET && m && Number(m[1]) > Date.now() && same(m[2], sign(m[1])));
}
const tries = new Map();
const cols = ['guest_name','attendance_status','bringing_anyone','additional_guest_count','additional_guest_names','total_attendees','arrival_note','drink_preference','guest_message','created_at','updated_at'];
const csvCell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0], now = Date.now();
    const a = (tries.get(ip) || []).filter(t => now - t < 9e5);
    if (a.length >= 5) return res.status(429).json({ error: 'Too many attempts. Try later.' });
    const pw = process.env.ADMIN_PASSWORD;
    if (!pw || !SECRET || !crypto.timingSafeEqual(h((req.body || {}).password), h(pw))) {
      a.push(now); tries.set(ip, a); return res.status(401).json({ error: 'Wrong password.' });
    }
    const exp = now + 8 * 3600e3;
    res.setHeader('Set-Cookie', `admin=${exp}.${sign(exp)}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=28800`);
    return res.status(200).json({ ok: true });
  }
  if (!authed(req)) return res.status(401).json({ error: 'Not signed in.' });
  try {
    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Bad id.' });
      await sql`delete from rsvps where id=${id}::uuid`; return res.status(200).json({ ok: true });
    }
    if (req.method !== 'GET') return res.status(405).end();
    const rows = await sql`select id, guest_name, attendance_status, case when bringing_anyone then 'yes' else 'no' end as bringing_anyone,
      additional_guest_count, additional_guest_names, total_attendees, arrival_note, drink_preference, guest_message, created_at, updated_at
      from rsvps order by created_at desc`;
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="rsvps.csv"');
      return res.status(200).send([cols.join(',')].concat(rows.map(r => cols.map(c => csvCell(r[c])).join(','))).join('\n'));
    }
    return res.status(200).json({ rows });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'Database error.' }); }
}
