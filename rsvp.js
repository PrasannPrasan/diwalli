import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';
const sql = neon(process.env.DATABASE_URL);
const hits = new Map(); // best-effort per-instance rate limit
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const UUID = /^[0-9a-f-]{36}$/i;
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0];
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 6e4);
  if (arr.length >= 8) return res.status(429).json({ error: 'Too many tries. Wait a minute.' });
  arr.push(now); hits.set(ip, arr);
  const b = req.body || {};
  const name = String(b.guest_name || '').trim();
  const going = b.attendance_status === 'going';
  if (!name || name.length > 80) return res.status(400).json({ error: 'Name is required (max 80 characters).' });
  if (!going && b.attendance_status !== 'declined') return res.status(400).json({ error: 'Invalid attendance.' });
  if (!['alcoholic', 'non-alcoholic', 'both'].includes(b.drink_preference)) return res.status(400).json({ error: 'Invalid drink preference.' });
  const bringing = going && b.bringing_anyone === 'yes';
  if (going && !['yes', 'no'].includes(b.bringing_anyone)) return res.status(400).json({ error: 'Tell us if you are bringing anyone.' });
  const count = bringing ? Number(b.additional_guest_count) : 0;
  if (bringing && !(Number.isSafeInteger(count) && count >= 1)) return res.status(400).json({ error: 'Additional guests must be a whole number, 1 or more.' });
  const note = String(b.arrival_note || '').trim().slice(0, 80);
  const names = bringing ? String(b.additional_guest_names || '').trim().slice(0, 300) : '';
  const msg = String(b.guest_message || '').trim().slice(0, 400);
  const total = going ? 1 + count : 0;
  try {
    let id = null, token = null;
    if (typeof b.id === 'string' && UUID.test(b.id) && typeof b.token === 'string') {
      const r = await sql`update rsvps set guest_name=${name}, attendance_status=${b.attendance_status}, arrival_note=${note},
        drink_preference=${b.drink_preference}, bringing_anyone=${bringing}, additional_guest_count=${count},
        additional_guest_names=${names}, total_attendees=${total}, guest_message=${msg}, updated_at=now()
        where id=${b.id}::uuid and edit_token_hash=${sha(b.token)} returning id`;
      if (r.length) { id = b.id; token = b.token; }
    }
    if (!id) {
      token = crypto.randomBytes(24).toString('hex');
      const r = await sql`insert into rsvps (guest_name, attendance_status, arrival_note, drink_preference, bringing_anyone,
        additional_guest_count, additional_guest_names, total_attendees, guest_message, edit_token_hash)
        values (${name}, ${b.attendance_status}, ${note}, ${b.drink_preference}, ${bringing}, ${count}, ${names}, ${total}, ${msg}, ${sha(token)}) returning id`;
      id = r[0].id;
    }
    // Maps link is released only here, after the row is saved.
    return res.status(200).json({ ok: true, id, token, total_attendees: total, maps_url: going ? process.env.MAPS_URL : null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Could not save your RSVP. Please try again.' });
  }
}
