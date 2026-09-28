#!/usr/bin/env node
// End-to-end test for BorrowBox. Follows the "End-to-End Workflow" story from the
// brief (Ali lists a drill, Sara borrows it ...) and then checks every endpoint in
// the REST API table plus the permission and business rules.
//
// Prerequisites: API running (npm run dev) on a database created with
//   npm run db:setup      (schema.sql + seed.sql - the test logs in as the seeded admin)
//
//   node scripts/smoke_test.mjs            # or: npm test
//   API_URL=http://localhost:4000/api node scripts/smoke_test.mjs

const BASE = process.env.API_URL || 'http://localhost:4000/api';
let failures = 0;
let passes = 0;

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, body: json };
}

function check(cond, msg, extra) {
  if (!cond) { console.error('  FAIL:', msg, extra !== undefined ? JSON.stringify(extra) : ''); failures++; }
  else { console.log('  ok  :', msg); passes++; }
}
const step = (title) => console.log(`\n${title}`);

// calendar dates relative to today, 'YYYY-MM-DD' (local time, matches what the DB calls CURRENT_DATE)
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Shorthand for PATCH /bookings/:id/status
const act = (token, id, action, note) =>
  req('PATCH', `/bookings/${id}/status`, { token, body: note === undefined ? { action } : { action, note } });

(async () => {
  const uniq = Date.now();

  // =================================================================
  step('Step 1 - Register & login');
  // =================================================================
  let r = await req('POST', '/auth/register', { body: { name: 'Ali Lender', email: `ali${uniq}@test.com`, password: 'password123', phone: '0300', area: 'DHA' } });
  check(r.status === 201 && r.body.token && r.body.user.id, 'POST /auth/register creates user and returns JWT', r.body);
  check(r.body.user.password_hash === undefined && r.body.user.role === 'member', 'password hash never returned; default role is member');
  const ali = { token: r.body.token, id: r.body.user.id, email: `ali${uniq}@test.com` };

  r = await req('POST', '/auth/register', { body: { name: 'Sara Borrower', email: `sara${uniq}@test.com`, password: 'password123' } });
  const sara = { token: r.body.token, id: r.body.user.id };
  r = await req('POST', '/auth/register', { body: { name: 'Carol Other', email: `carol${uniq}@test.com`, password: 'password123' } });
  const carol = { token: r.body.token, id: r.body.user.id };

  r = await req('POST', '/auth/register', { body: { name: 'Dup', email: ali.email, password: 'password123' } });
  check(r.status === 409, 'duplicate email -> 409', r.body);
  r = await req('POST', '/auth/register', { body: { name: 'X', email: 'not-an-email', password: '123' } });
  check(r.status === 400, 'invalid register payload -> 400', r.body);

  r = await req('POST', '/auth/login', { body: { email: ali.email, password: 'wrong-password' } });
  check(r.status === 401, 'wrong password -> 401');
  r = await req('POST', '/auth/login', { body: { email: ali.email, password: 'password123' } });
  check(r.status === 200 && r.body.token, 'POST /auth/login verifies credentials, returns JWT');

  r = await req('GET', '/auth/me', { token: ali.token });
  check(r.status === 200 && r.body.user.id === ali.id, 'GET /auth/me returns logged-in user');
  r = await req('GET', '/auth/me');
  check(r.status === 401, 'GET /auth/me without token -> 401');

  r = await req('POST', '/auth/login', { body: { email: 'admin@borrowbox.local', password: 'admin1234' } });
  check(r.status === 200 && r.body.user.role === 'admin', 'seeded admin can log in (run `npm run db:setup` if this fails)', r.body);
  const admin = { token: r.body.token };

  // =================================================================
  step('Categories (admin only)');
  // =================================================================
  r = await req('GET', '/categories');
  check(r.status === 200 && r.body.categories.length > 0, 'GET /categories is public');
  const powerTools = r.body.categories.find((c) => c.name === 'Power Tools');
  check(!!powerTools, 'seed data contains the "Power Tools" category');

  r = await req('POST', '/categories', { token: sara.token, body: { name: `Nope-${uniq}` } });
  check(r.status === 403, 'member cannot create a category -> 403');
  r = await req('POST', '/categories', { token: admin.token, body: { name: `Temp-${uniq}` } });
  check(r.status === 201, 'admin creates category', r.body);
  const tempCat = r.body.category.id;
  r = await req('POST', '/categories', { token: admin.token, body: { name: `Temp-${uniq}` } });
  check(r.status === 409, 'duplicate category name -> 409');
  r = await req('PUT', `/categories/${tempCat}`, { token: admin.token, body: { name: `Renamed-${uniq}` } });
  check(r.status === 200 && r.body.category.name === `Renamed-${uniq}`, 'PUT /categories/:id renames');
  r = await req('PUT', `/categories/${tempCat}`, { token: ali.token, body: { name: 'x' } });
  check(r.status === 403, 'member cannot rename category -> 403');

  // =================================================================
  step('Step 2 - List an item');
  // =================================================================
  const bad = { title: 'Bad', category_id: powerTools.id, condition: 'good', max_days: 5 };
  r = await req('POST', '/items', { token: ali.token, body: { ...bad, condition: 'broken' } });
  check(r.status === 400, 'condition outside (new, good, fair) -> 400');
  r = await req('POST', '/items', { token: ali.token, body: { ...bad, max_days: 0 } });
  check(r.status === 400, 'max_days must be > 0 -> 400');
  r = await req('POST', '/items', { body: bad });
  check(r.status === 401, 'POST /items without token -> 401');

  r = await req('POST', '/items', { token: ali.token, body: { title: `Cordless Drill ${uniq}`, description: 'Bosch 18V', category_id: powerTools.id, condition: 'good', max_days: 5, pickup_area: 'DHA Phase 5' } });
  check(r.status === 201 && r.body.item.owner_id === ali.id, 'POST /items saves a row linked to owner_id', r.body);
  check(r.body.item.condition === 'good' && r.body.item.max_days === 5, 'item stores condition + max_days');
  const drillId = r.body.item.id;

  r = await req('GET', '/items/mine', { token: ali.token });
  check(r.status === 200 && r.body.items.some((i) => i.id === drillId), 'GET /items/mine lists my items (declared before /:id)');

  // =================================================================
  step('Step 3 - Search (date-aware, NOT EXISTS sub-query)');
  // =================================================================
  const from = inDays(2), to = inDays(4);
  r = await req('GET', `/items?search=drill&from=${from}&to=${to}`);
  check(r.status === 200 && r.body.items.some((i) => i.id === drillId), 'GET /items?search=&from=&to= finds the free drill');
  r = await req('GET', `/items?search=${uniq}&category=${powerTools.id}&page=1`);
  check(r.status === 200 && r.body.items.length === 1 && r.body.pagination.total === 1, 'search + category + page work together');
  r = await req('GET', `/items?category=${encodeURIComponent('power tools')}&search=${uniq}`);
  check(r.status === 200 && r.body.items.length === 1, 'category also accepts a name');
  r = await req('GET', `/items?from=${from}`);
  check(r.status === 400, 'from without to -> 400');
  r = await req('GET', `/items?from=${to}&to=${from}`);
  check(r.status === 400, 'to before from -> 400');
  r = await req('GET', '/items?from=2026-13-45&to=2026-13-46');
  check(r.status === 400, 'invalid dates -> 400');
  r = await req('GET', `/items?search=${encodeURIComponent('100%_')}`);
  check(r.status === 200 && r.body.items.length === 0, 'LIKE wildcards in search are escaped');

  // =================================================================
  step('Step 4 - Item detail + availability');
  // =================================================================
  r = await req('GET', `/items/${drillId}`);
  check(r.status === 200 && r.body.item.owner_name === 'Ali Lender' && 'owner_rating' in r.body.item, 'GET /items/:id returns owner info and rating');
  r = await req('GET', `/items/${drillId}/availability`);
  check(r.status === 200 && Array.isArray(r.body.booked) && r.body.booked.length === 0, 'GET /items/:id/availability starts empty');
  r = await req('GET', '/items/999999/availability');
  check(r.status === 404, 'availability of unknown item -> 404');
  r = await req('GET', '/items/abc');
  check(r.status === 400, 'non-numeric id -> 400 (not a 500)');

  // =================================================================
  step('Step 5 - Request (business rules validated first)');
  // =================================================================
  const book = (token, item_id, s, e, message) => req('POST', '/bookings', { token, body: { item_id, start_date: s, end_date: e, message } });

  r = await book(ali.token, drillId, inDays(1), inDays(3));
  check(r.status === 400, 'cannot borrow your own item -> 400', r.body);
  r = await book(sara.token, drillId, inDays(1), inDays(10));
  check(r.status === 400, 'longer than max_days -> 400', r.body);
  r = await book(sara.token, drillId, inDays(-2), inDays(1));
  check(r.status === 400, 'start_date in the past -> 400', r.body);
  r = await book(sara.token, drillId, inDays(5), inDays(3));
  check(r.status === 400, 'end before start -> 400', r.body);
  r = await book(sara.token, drillId, '2026-99-99', inDays(3));
  check(r.status === 400, 'malformed date -> 400', r.body);
  r = await book(sara.token, 999999, inDays(1), inDays(3));
  check(r.status === 404, 'unknown item -> 404', r.body);
  r = await book(undefined, drillId, inDays(1), inDays(3));
  check(r.status === 401, 'anonymous request -> 401');

  r = await book(sara.token, drillId, inDays(2), inDays(4), 'Need it for a shelf');
  check(r.status === 201 && r.body.booking.status === 'REQUESTED', 'POST /bookings inserts a REQUESTED booking', r.body);
  const saraBooking = r.body.booking.id;
  check(r.body.booking.start_date === inDays(2), 'dates come back as plain YYYY-MM-DD (no timezone shift)', r.body.booking.start_date);

  r = await book(carol.token, drillId, inDays(3), inDays(5));
  check(r.status === 201, 'overlapping REQUESTED bookings are allowed until one is approved');
  const carolBooking = r.body.booking.id;

  // =================================================================
  step('Step 6 - Owner is notified (Incoming Requests)');
  // =================================================================
  r = await req('GET', '/bookings/incoming', { token: ali.token });
  check(r.status === 200 && r.body.bookings.filter((b) => b.item_id === drillId).length === 2, 'GET /bookings/incoming shows both requests to the owner');
  check(r.body.bookings[0].borrower_name && r.body.bookings[0].is_overdue === false, 'incoming rows carry borrower_name and is_overdue');
  r = await req('GET', '/bookings/incoming?status=NOPE', { token: ali.token });
  check(r.status === 400, 'invalid status filter -> 400');
  r = await req('GET', '/bookings/mine', { token: sara.token });
  check(r.status === 200 && r.body.bookings.some((b) => b.id === saraBooking), 'GET /bookings/mine lists my borrowings');
  r = await req('GET', '/bookings/incoming', { token: sara.token });
  check(r.status === 200 && r.body.bookings.length === 0, "Sara owns nothing, so she has no incoming requests");

  // =================================================================
  step('Step 7 - Approve (lock item, re-check overlap, auto-reject clashes)');
  // =================================================================
  r = await act(sara.token, saraBooking, 'approve');
  check(r.status === 403, 'borrower cannot approve -> 403');
  r = await act(carol.token, saraBooking, 'approve');
  check(r.status === 403, 'stranger cannot approve -> 403');
  r = await act(ali.token, saraBooking, 'pickup', 'too early');
  check(r.status === 409, 'cannot pickup before approval -> 409', r.body);
  r = await act(ali.token, saraBooking, 'fly');
  check(r.status === 400, 'unknown action -> 400');
  r = await act(ali.token, 999999, 'approve');
  check(r.status === 404, 'unknown booking -> 404');

  r = await act(ali.token, saraBooking, 'approve');
  check(r.status === 200 && r.body.booking.status === 'APPROVED', 'owner approves', r.body);
  check(r.body.auto_rejected.includes(carolBooking), 'clashing REQUESTED booking auto-rejected in the same transaction', r.body);
  r = await req('GET', `/bookings/${carolBooking}`, { token: carol.token });
  check(r.body.booking.status === 'REJECTED' && !!r.body.booking.reject_reason, "Carol's request is REJECTED with a reason", r.body.booking);

  r = await book(carol.token, drillId, inDays(4), inDays(4));
  check(r.status === 409, 'new request overlapping an APPROVED booking -> 409 Conflict', r.body);
  r = await req('GET', `/items?search=${uniq}&from=${from}&to=${to}`);
  check(r.status === 200 && r.body.items.length === 0, 'search hides the drill for the approved dates');
  r = await req('GET', `/items?search=${uniq}&from=${inDays(20)}&to=${inDays(22)}`);
  check(r.status === 200 && r.body.items.length === 1, 'search still shows the drill for free dates');
  r = await req('GET', `/items/${drillId}/availability`);
  check(r.body.booked.length === 1 && r.body.booked[0].start_date === inDays(2) && r.body.booked[0].end_date === inDays(4), 'availability lists the approved range');

  // =================================================================
  step('Step 8 - Handover (condition log, stage = handover)');
  // =================================================================
  r = await act(ali.token, saraBooking, 'pickup');
  check(r.status === 400, 'pickup without a note -> 400');
  r = await act(sara.token, saraBooking, 'pickup', 'borrower cannot do this');
  check(r.status === 403, 'only the owner can mark picked up -> 403');
  r = await act(ali.token, saraBooking, 'pickup', 'Good, one scratch on the handle.');
  check(r.status === 200 && r.body.booking.status === 'PICKED_UP', 'owner marks PICKED_UP', r.body);
  r = await req('GET', `/bookings/${saraBooking}`, { token: ali.token });
  check(r.body.condition_logs.length === 1 && r.body.condition_logs[0].stage === 'handover' && r.body.condition_logs[0].logged_by === ali.id, 'condition_logs row created (stage = handover)', r.body.condition_logs);
  r = await act(sara.token, saraBooking, 'cancel');
  check(r.status === 409, 'cannot cancel once PICKED_UP -> 409');
  r = await act(ali.token, saraBooking, 'approve');
  check(r.status === 409, 'cannot approve twice -> 409');

  // =================================================================
  step('Step 9 - Return (second condition log, reviews unlock)');
  // =================================================================
  r = await req('POST', `/bookings/${saraBooking}/reviews`, { token: sara.token, body: { rating: 5 } });
  check(r.status === 409, 'reviews are locked until RETURNED -> 409');
  r = await act(ali.token, saraBooking, 'return', 'Returned clean.');
  check(r.status === 200 && r.body.booking.status === 'RETURNED', 'owner marks RETURNED', r.body);
  r = await req('GET', `/bookings/${saraBooking}`, { token: sara.token });
  check(r.body.condition_logs.length === 2 && r.body.condition_logs[1].stage === 'return', 'second condition log saved (stage = return)', r.body.condition_logs);
  r = await req('GET', `/bookings/${saraBooking}`, { token: carol.token });
  check(r.status === 403, 'a stranger cannot read the booking -> 403');
  r = await act(ali.token, saraBooking, 'return', 'again');
  check(r.status === 409, 'cannot return twice -> 409');

  // OVERDUE is computed: the seed data has Omar holding a camera past its end_date
  r = await req('POST', '/auth/login', { body: { email: 'omar@example.com', password: 'password123' } });
  if (r.status === 200) {
    const omar = r.body.token;
    const mine = await req('GET', '/bookings/mine', { token: omar });
    const overdue = mine.body.bookings.find((b) => b.status === 'PICKED_UP' && b.end_date < inDays(0));
    if (overdue) check(overdue.is_overdue === true, 'PICKED_UP booking past its end_date carries is_overdue = true', overdue);
    else console.log('  skip: no overdue PICKED_UP booking in the seed data any more');
  } else console.log('  skip: seed user omar@example.com not found');

  // =================================================================
  step('Step 10 - Review (both sides; trust score = AVG(rating))');
  // =================================================================
  r = await req('POST', `/bookings/${saraBooking}/reviews`, { token: carol.token, body: { rating: 5 } });
  check(r.status === 403, 'non-party cannot review -> 403');
  r = await req('POST', `/bookings/${saraBooking}/reviews`, { token: sara.token, body: { rating: 6 } });
  check(r.status === 400, 'rating outside 1-5 -> 400');
  r = await req('POST', `/bookings/${saraBooking}/reviews`, { token: sara.token, body: { rating: 4, comment: 'Great lender.' } });
  check(r.status === 201 && r.body.review.reviewee_id === ali.id && r.body.review.reviewer_id === sara.id, 'borrower reviews owner', r.body);
  const saraReview = r.body.review.id;
  r = await req('POST', `/bookings/${saraBooking}/reviews`, { token: sara.token, body: { rating: 5 } });
  check(r.status === 409, 'one review per side per booking -> 409');
  r = await req('POST', `/bookings/${saraBooking}/reviews`, { token: ali.token, body: { rating: 5, comment: 'Responsible borrower.' } });
  check(r.status === 201 && r.body.review.reviewee_id === sara.id, 'owner reviews borrower');
  const aliReview = r.body.review.id;

  r = await req('GET', `/users/${ali.id}`);
  check(r.status === 200 && r.body.trust_score === 4 && r.body.review_count === 1, 'Ali trust score = 4 (average of ratings received)', r.body);
  check(r.body.reviews[0].reviewer_name === 'Sara Borrower', 'public profile lists reviews with reviewer name');
  r = await req('GET', `/users/${carol.id}`);
  check(r.body.trust_score === null && r.body.review_count === 0, 'no reviews yet -> trust_score null (not 0)');
  r = await req('GET', '/users/999999');
  check(r.status === 404, 'unknown user -> 404');

  // =================================================================
  step('Step 11 - Edit & clean up (CRUD)');
  // =================================================================
  r = await req('PUT', `/items/${drillId}`, { token: ali.token, body: { description: 'Bosch 18V, two batteries' } });
  check(r.status === 200 && r.body.item.description === 'Bosch 18V, two batteries' && r.body.item.title.startsWith('Cordless Drill'), 'PUT /items/:id edits the description, other fields unchanged');
  r = await req('PUT', `/items/${drillId}`, { token: sara.token, body: { description: 'hacked' } });
  check(r.status === 403, 'only the owner can edit an item -> 403');
  r = await req('PUT', `/items/${drillId}`, { token: admin.token, body: { description: 'admin edit' } });
  check(r.status === 403, 'PUT /items/:id is Owner-only per the API table (admin -> 403)');
  r = await req('PUT', `/items/${drillId}`, { token: ali.token, body: { condition: 'fair', max_days: 7 } });
  check(r.status === 200 && r.body.item.condition === 'fair' && r.body.item.max_days === 7, 'PUT changes condition and max_days');

  // Sara edits a pending request, then removes a cancelled one
  r = await book(sara.token, drillId, inDays(10), inDays(11), 'first try');
  const pending = r.body.booking.id;
  r = await req('PUT', `/bookings/${pending}`, { token: sara.token, body: { start_date: inDays(12), end_date: inDays(14), message: 'changed dates' } });
  check(r.status === 200 && r.body.booking.start_date === inDays(12) && r.body.booking.message === 'changed dates', 'PUT /bookings/:id edits dates + message while REQUESTED', r.body);
  r = await req('PUT', `/bookings/${pending}`, { token: sara.token, body: { end_date: inDays(30) } });
  check(r.status === 400, 'edit still enforces max_days -> 400');
  r = await req('PUT', `/bookings/${pending}`, { token: carol.token, body: { message: 'x' } });
  check(r.status === 403, 'only the borrower can edit -> 403');
  r = await req('PUT', `/bookings/${saraBooking}`, { token: sara.token, body: { message: 'x' } });
  check(r.status === 409, 'cannot edit a booking that is no longer REQUESTED -> 409');

  r = await req('DELETE', `/bookings/${pending}`, { token: sara.token });
  check(r.status === 409, 'cannot delete a REQUESTED booking -> 409');
  r = await act(sara.token, pending, 'cancel');
  check(r.status === 200 && r.body.booking.status === 'CANCELLED', 'borrower cancels');
  r = await req('DELETE', `/bookings/${pending}`, { token: carol.token });
  check(r.status === 403, 'stranger cannot delete a booking -> 403');
  r = await req('DELETE', `/bookings/${pending}`, { token: sara.token });
  check(r.status === 204, 'DELETE /bookings/:id removes a CANCELLED booking');
  r = await req('DELETE', `/bookings/${carolBooking}`, { token: admin.token });
  check(r.status === 204, 'admin can remove a REJECTED booking');

  // reviews: edit + delete
  r = await req('PUT', `/reviews/${saraReview}`, { token: ali.token, body: { rating: 1 } });
  check(r.status === 403, 'only the reviewer can edit a review -> 403');
  r = await req('PUT', `/reviews/${saraReview}`, { token: sara.token, body: { rating: 5, comment: 'Updated: excellent.' } });
  check(r.status === 200 && r.body.review.rating === 5 && r.body.review.comment === 'Updated: excellent.', 'PUT /reviews/:id edits rating and comment');
  r = await req('PUT', `/reviews/${saraReview}`, { token: sara.token, body: { rating: 3 } });
  check(r.body.review.comment === 'Updated: excellent.', 'PUT with only a rating keeps the comment');
  r = await req('GET', `/users/${ali.id}`);
  check(r.body.trust_score === 3, 'trust score follows the edited rating (3)', r.body.trust_score);
  r = await req('DELETE', `/reviews/${aliReview}`, { token: carol.token });
  check(r.status === 403, 'stranger cannot delete a review -> 403');
  r = await req('DELETE', `/reviews/${aliReview}`, { token: ali.token });
  check(r.status === 204, 'reviewer deletes own review');
  r = await req('DELETE', `/reviews/${saraReview}`, { token: admin.token });
  check(r.status === 204, 'admin can delete any review');
  r = await req('DELETE', `/reviews/${saraReview}`, { token: admin.token });
  check(r.status === 404, 'deleted review is gone -> 404');

  // =================================================================
  step('Rules: max 3 open bookings per borrower');
  // =================================================================
  const extra = [];
  for (let i = 0; i < 4; i++) {
    r = await req('POST', '/items', { token: ali.token, body: { title: `Ladder ${i} ${uniq}`, category_id: powerTools.id, max_days: 3 } });
    extra.push(r.body.item.id);
  }
  check(r.status === 201 && r.body.item.condition === 'good', 'condition defaults to good when omitted', r.body.item);
  const opened = [];
  for (let i = 0; i < 3; i++) {
    r = await book(carol.token, extra[i], inDays(1), inDays(2));
    check(r.status === 201, `carol open booking #${i + 1}`);
    opened.push(r.body.booking.id);
  }
  r = await book(carol.token, extra[3], inDays(1), inDays(2));
  check(r.status === 409, '4th open booking -> 409', r.body);

  // =================================================================
  step('Concurrency: two clashing requests approved at the same instant');
  // =================================================================
  r = await req('POST', '/items', { token: ali.token, body: { title: `Race Item ${uniq}`, category_id: powerTools.id, max_days: 5 } });
  const raceItem = r.body.item.id;
  r = await req('POST', '/auth/register', { body: { name: 'Dave Racer', email: `dave${uniq}@test.com`, password: 'password123' } });
  const dave = { token: r.body.token, id: r.body.user.id };
  const rb1 = (await book(sara.token, raceItem, inDays(6), inDays(8))).body.booking.id;
  const rb2 = (await book(dave.token, raceItem, inDays(7), inDays(9))).body.booking.id;
  const results = await Promise.all([act(ali.token, rb1, 'approve'), act(ali.token, rb2, 'approve')]);
  const codes = results.map((x) => x.status).sort();
  check(codes[0] === 200 && codes[1] === 409, 'exactly one of two clashing approvals succeeds (item row lock)', codes);
  r = await req('GET', `/items/${raceItem}/availability`);
  check(r.body.booked.length === 1, 'only one approved booking exists for the item');

  // =================================================================
  step('Items: delete vs deactivate');
  // =================================================================
  r = await req('DELETE', `/items/${drillId}`, { token: sara.token });
  check(r.status === 403, 'non-owner cannot delete an item -> 403');
  r = await req('DELETE', `/items/${drillId}`, { token: ali.token });
  check(r.status === 200 && r.body.deactivated === true, 'item with booking history is deactivated, not deleted', r.body);
  r = await book(sara.token, drillId, inDays(20), inDays(21));
  check(r.status === 400, 'deactivated item cannot be requested -> 400');
  r = await req('GET', `/items?search=${uniq}&category=${powerTools.id}`);
  check(!r.body.items.some((i) => i.id === drillId), 'deactivated item is hidden from search');
  r = await req('POST', '/items', { token: ali.token, body: { title: `Never Booked ${uniq}`, category_id: powerTools.id, max_days: 2 } });
  r = await req('DELETE', `/items/${r.body.item.id}`, { token: ali.token });
  check(r.status === 204, 'item that never had a booking is hard-deleted -> 204');

  // =================================================================
  step('Categories: delete rules');
  // =================================================================
  r = await req('DELETE', `/categories/${powerTools.id}`, { token: admin.token });
  check(r.status === 409, 'category in use cannot be deleted -> 409');
  r = await req('DELETE', `/categories/${tempCat}`, { token: admin.token });
  check(r.status === 204, 'unused category is deleted');
  r = await req('DELETE', `/categories/${tempCat}`, { token: admin.token });
  check(r.status === 404, 'deleting it again -> 404');

  // =================================================================
  step('Users: update + soft delete');
  // =================================================================
  r = await req('PUT', '/users/me', { token: sara.token, body: { name: 'Sara B.', phone: '0311', area: 'Gulberg' } });
  check(r.status === 200 && r.body.user.name === 'Sara B.' && r.body.user.area === 'Gulberg', 'PUT /users/me updates name, phone, area');
  r = await req('PUT', '/users/me', { token: sara.token, body: { phone: '' } });
  check(r.body.user.phone === null && r.body.user.name === 'Sara B.', 'empty phone clears it; other fields untouched');
  r = await req('PUT', '/users/me', { token: sara.token, body: { name: '  ' } });
  check(r.status === 400, 'blank name -> 400');
  r = await req('PUT', '/users/me', { token: sara.token, body: { email: 'new@x.com', role: 'admin' } });
  check(r.status === 200 && r.body.user.role === 'member' && r.body.user.email === `sara${uniq}@test.com`, 'email/role cannot be changed through PUT /users/me');

  // Carol has 3 open bookings from the max-3 test -> blocked
  r = await req('DELETE', '/users/me', { token: carol.token });
  check(r.status === 409, 'DELETE /users/me is blocked while bookings are open -> 409', r.body);
  for (const id of opened) await act(carol.token, id, 'cancel');
  r = await req('DELETE', '/users/me', { token: carol.token });
  check(r.status === 204, 'DELETE /users/me soft-deletes once nothing is open');
  r = await req('GET', '/auth/me', { token: carol.token });
  check(r.status === 403, 'soft-deleted user can no longer use the API (403)');
  r = await req('GET', `/users/${carol.id}`);
  check(r.status === 404, 'soft-deleted user disappears from public profiles');
  r = await req('POST', '/auth/login', { body: { email: `carol${uniq}@test.com`, password: 'password123' } });
  check(r.status === 403, 'soft-deleted user cannot log in');
  r = await req('DELETE', '/users/me', { token: admin.token });
  check(r.status === 403, 'admin cannot delete themselves');

  // Ali still has an approved booking on the race item -> blocked as an OWNER too
  r = await req('DELETE', '/users/me', { token: ali.token });
  check(r.status === 409, 'owner with an open booking on their item cannot delete account -> 409');

  // =================================================================
  step('Admin');
  // =================================================================
  r = await req('GET', '/admin/stats', { token: sara.token });
  check(r.status === 403, 'member cannot read admin stats -> 403');
  r = await req('GET', '/admin/stats', { token: admin.token });
  check(r.status === 200 && r.body.total_users >= 4 && r.body.bookings_by_status.APPROVED >= 1 && 'REJECTED' in r.body.bookings_by_status, 'GET /admin/stats: users, items, bookings by status', r.body);
  r = await req('GET', '/admin/users', { token: admin.token });
  check(r.status === 200 && r.body.users.length >= 4 && r.body.users[0].password_hash === undefined, 'GET /admin/users lists users without password hashes');
  r = await req('GET', '/admin/users', { token: ali.token });
  check(r.status === 403, 'member cannot list users -> 403');
  r = await req('GET', '/dashboard/summary', { token: sara.token });
  check(r.status === 200 && typeof r.body.open_borrowings === 'number', 'dashboard summary returns counts');

  // =================================================================
  step('Misc');
  // =================================================================
  r = await req('GET', '/nope');
  check(r.status === 404, 'unknown route -> 404 JSON');
  const raw = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
  check(raw.status === 400, 'malformed JSON body -> 400');

  console.log(`\n${passes} passed, ${failures} failed`);
  console.log(failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
})().catch((e) => {
  console.error('Smoke test crashed:', e);
  process.exitCode = 1;
});
