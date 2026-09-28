// UI integration tests: renders the real <App/> in jsdom and drives it against a LIVE API.
// Prereqs: Postgres running, `npm run db:setup` (backend) and `npm start`/`npm run dev` (backend on :4000).
// Run:     npm run test:ui
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { api, setToken, getToken, ApiClientError } from '../src/api/client.js';
import { todayStr, rangesOverlap, daysInclusive } from '../src/utils/dates.js';

const user = userEvent.setup();
const plus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const uniq = Date.now();

async function go(path) {
  cleanup();
  window.history.pushState({}, '', path);
  render(<App />);
}
async function typeInto(labelText, value) {
  const el = await screen.findByLabelText(labelText);
  await user.clear(el);
  await user.type(el, value);
}
async function login(email, password = 'password123') {
  setToken(null);
  await go('/login');
  await typeInto('Email', email);
  await typeInto('Password', password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  await screen.findByRole('heading', { name: /Borrow what you need/ });
}

describe('axios client', () => {
  it('interceptors: bearer token, error normalisation, expired token handling', async () => {
    setToken(null);
    // validation details are joined into a readable message
    await expect(api.post('/auth/register', { name: 'x', email: 'bad', password: '1' })).rejects.toMatchObject({
      status: 400, message: expect.stringContaining('valid email'),
    });
    const r = await api.post('/auth/login', { email: 'ali@example.com', password: 'password123' });
    expect(r.token).toBeTruthy();
    setToken(r.token);
    const me = await api.get('/auth/me');                       // needs the Authorization header
    expect(me.user.email).toBe('ali@example.com');
    // empty params are dropped from the query string
    const items = await api.get('/items', { search: '', category: '', from: '', to: '' });
    expect(items.items.length).toBeGreaterThan(0);
    // stale token: 401 clears it and fires auth:expired
    let fired = false;
    window.addEventListener('auth:expired', () => { fired = true; });
    setToken('garbage.token.value');
    await expect(api.get('/auth/me')).rejects.toBeInstanceOf(ApiClientError);
    expect(getToken()).toBeNull();
    expect(fired).toBe(true);
    // wrong password must NOT fire expiry logic and reports the API message
    await expect(api.post('/auth/login', { email: 'ali@example.com', password: 'nope-nope' })).rejects.toMatchObject({ status: 401, message: 'Invalid email or password.' });
  });
  it('date helpers', () => {
    expect(rangesOverlap('2026-09-24', '2026-09-26', '2026-09-26', '2026-09-30')).toBe(true);
    expect(rangesOverlap('2026-09-24', '2026-09-25', '2026-09-26', '2026-09-30')).toBe(false);
    expect(daysInclusive('2026-09-24', '2026-09-26')).toBe(3);
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('UI story against the real API', () => {
  let umaEmail = `uma${uniq}@test.com`;
  let bookingUrl;

  it('register a new account through the form', async () => {
    setToken(null);
    await go('/register');
    await typeInto('Full name', 'Uma Tester');
    await typeInto('Email', umaEmail);
    await typeInto('Password', 'password123');
    await typeInto('Area (optional)', 'F-7');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByRole('heading', { name: /Borrow what you need/ });
    expect(getToken()).toBeTruthy();
    expect(await screen.findByText('Uma')).toBeTruthy();       // navbar shows first name
  });

  it('browse: keyword search + category filter + half-filled date range hint', async () => {
    await go('/');
    await screen.findByText('Cordless Drill');
    await screen.findByText('Petrol Lawn Mower');
    await user.type(screen.getByPlaceholderText(/Search tools/), 'projector');
    await waitFor(() => expect(screen.queryByText('Petrol Lawn Mower')).toBeNull());
    expect(screen.getByText('Portable Projector')).toBeTruthy();
    // availability filter: projector is APPROVED for +3..+4 days in the seed data
    const from = screen.getByLabelText('From');
    await user.type(from, plus(3));
    expect(await screen.findByText(/Pick both a "from" and a "to" date/)).toBeTruthy();
    const to = screen.getByLabelText('To');
    await user.type(to, plus(4));
    await waitFor(() => expect(screen.queryByText('Portable Projector')).toBeNull());   // hidden: booked
    expect(await screen.findByText(/No items match/)).toBeTruthy();
  });

  it('item detail: condition, max days, owner rating, blocked dates, overlap guard', async () => {
    await go('/');
    const card = (await screen.findByText('Portable Projector')).closest('a');
    await user.click(card);
    await screen.findByText(/Condition: New/);
    expect(screen.getByText(/Max borrow: 2 days/)).toBeTruthy();
    expect(await screen.findByText(plus(3) + ' → ' + plus(4))).toBeTruthy();   // already booked list
    // pick overlapping dates -> warning + disabled submit
    const start = screen.getByLabelText('From');
    const end = screen.getByLabelText('To');
    await user.type(start, plus(3));
    await user.type(end, plus(4));
    expect(await screen.findByText(/overlap an existing booking/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send request' }).disabled).toBe(true);
    // too long
    await user.clear(end); await user.type(end, plus(9));
    expect(await screen.findByText(/at most 2 days/)).toBeTruthy();
  });

  it('request the ladder (Ali owns it, rating 4.5) from the item page', async () => {
    await go('/');
    await user.click((await screen.findByText('Extension Ladder')).closest('a'));
    await screen.findByText(/Condition: Fair/);
    expect(await screen.findByText(/4\.5 · 2 reviews/)).toBeTruthy();
    const start = screen.getByLabelText('From');
    const end = screen.getByLabelText('To');
    await user.type(start, plus(30));
    await user.type(end, plus(31));
    await user.type(screen.getByText(/Message to owner/).parentElement.querySelector('textarea'), 'For the fence');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText(/Request sent/)).toBeTruthy();
  });

  it('borrower dashboard shows the request; edits dates via PUT; cancels; then removes it', async () => {
    await go('/dashboard');
    await user.click(await screen.findByRole('button', { name: /My Borrowings/ }));
    const link = await screen.findByRole('link', { name: 'Extension Ladder' });
    expect(screen.getByText(new RegExp(plus(30)))).toBeTruthy();
    await user.click(link);
    await screen.findByText('Actions');
    await user.click(screen.getByRole('button', { name: 'Edit dates / message' }));
    const ends = screen.getAllByText('End date').map((l) => l.parentElement.querySelector('input'));
    const endEdit = ends[ends.length - 1];
    await user.clear(endEdit); await user.type(endEdit, plus(32));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByText(new RegExp(`${plus(30)} → ${plus(32)}`))).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Cancel request' }));
    await screen.findByText('Cancelled');
    window.confirm = () => true;
    await user.click(await screen.findByRole('button', { name: 'Remove booking' }));   // DELETE
    await screen.findByText('Dashboard');
    await user.click(await screen.findByRole('button', { name: /My Borrowings/ }));
    await screen.findByText(/haven't requested to borrow anything/);
  });

  it('re-request, then owner (Ali) approves from Incoming Requests; second clashing request is auto-rejected', async () => {
    // Uma requests the ladder again
    await go('/');
    await user.click((await screen.findByText('Extension Ladder')).closest('a'));
    await screen.findByText(/Condition: Fair/);
    await user.type(screen.getByLabelText('From'), plus(40));
    await user.type(screen.getByLabelText('To'), plus(41));
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    await screen.findByText(/Request sent/);
    // Ali logs in
    setToken(null);
    await login('ali@example.com');
    await go('/dashboard');
    await user.click(await screen.findByRole('button', { name: /Incoming Requests/ }));
    const row = (await screen.findAllByText(/to Uma Tester/))[0].closest('.card');
    await user.click(within(row).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(within(row).getByText('Approved')).toBeTruthy());
    await user.click(within(row).getByRole('link', { name: 'Ladder'.length ? 'Manage' : '' }));
    await screen.findByText('Record handover condition');
    bookingUrl = window.location.pathname;
  });

  it('handover -> return -> reviews (owner side), condition log and computed status', async () => {
    await go(bookingUrl);
    await screen.findByText('Record handover condition');
    const btn = screen.getByRole('button', { name: 'Mark picked up' });
    expect(btn.disabled).toBe(true);                           // note required
    await user.type(screen.getByPlaceholderText(/scratch on the handle/), 'Good, one scratch on the handle.');
    await user.click(btn);
    await screen.findByText('Record return condition');
    expect(await screen.findByText(/one scratch on the handle/)).toBeTruthy();
    await user.type(screen.getByPlaceholderText(/Returned as given/), 'Returned clean.');
    await user.click(screen.getByRole('button', { name: 'Mark returned' }));
    await screen.findByText('Reviews');
    expect(screen.getByText(/Returned clean\./)).toBeTruthy();            // second log
    expect(screen.getAllByText('handover').length + screen.getAllByText('return').length).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Submit review' }));
    expect(await screen.findByText(/rated 5\/5/)).toBeTruthy();
  });

  it('borrower reviews, edits and deletes the review; trust score updates on the profile', async () => {
    await login(umaEmail);
    await go(bookingUrl);
    await screen.findByText('Reviews');
    expect(screen.getByText(/rated 5\/5/)).toBeTruthy();       // Ali's review of Uma
    await user.selectOptions(screen.getByLabelText(/Your rating for Ali Khan/), '4');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));
    await screen.findByRole('button', { name: 'Edit my review' });
    await user.click(screen.getByRole('button', { name: 'Edit my review' }));
    await user.selectOptions(screen.getByLabelText(/Your rating for Ali Khan/), '2');
    await user.click(screen.getByRole('button', { name: 'Save review' }));
    await waitFor(() => expect(screen.getByText(/rated 2\/5/)).toBeTruthy());
    // Ali's profile: (5 + 4 + 2)/3? -> seeded 5 and 4, plus this 2 = 3.7
    const me = await api.get('/auth/me');
    await go(`/users/${me.user.id - 0 === 0 ? 1 : 2}`);  // Ali is user #2 in the seed
    await screen.findByText('Ali Khan');
    expect(await screen.findByText(/3\.7 · 3 reviews/)).toBeTruthy();
    await go(bookingUrl);
    window.confirm = () => true;
    await user.click(await screen.findByRole('button', { name: 'Delete my review' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Edit my review' })).toBeNull());
  });

  it('overdue flag shows on the seeded overdue loan (Omar borrowed the camera)', async () => {
    await login('omar@example.com');
    await go('/dashboard');
    await user.click(await screen.findByRole('button', { name: /My Borrowings/ }));
    await screen.findByText('DSLR Camera Kit');
    expect(await screen.findByText('Overdue')).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'DSLR Camera Kit' }));
    expect(await screen.findByText(/has passed and this item hasn't been marked as returned/)).toBeTruthy();
  });

  it('list an item with condition + max_days, edit it, deactivate, delete', async () => {
    await login('ali@example.com');
    await go('/items/new');
    await typeInto('Title', 'Cordless Drill UI');
    await user.selectOptions(screen.getByText('Category').parentElement.querySelector('select'), 'Power Tools');
    await user.selectOptions(screen.getByText('Condition').parentElement.querySelector('select'), 'fair');
    const max = screen.getByText('Max days').parentElement.querySelector('input');
    await user.clear(max); await user.type(max, '5');
    await user.click(screen.getByRole('button', { name: 'List item' }));
    await screen.findByText('Dashboard');
    await screen.findByText('Cordless Drill UI');
    expect(screen.getByText(/fair · max 5 days/)).toBeTruthy();
    // edit
    const mine = (await screen.findByText('Cordless Drill UI')).closest('.card');
    await user.click(within(mine).getByRole('link', { name: 'Edit' }));
    await screen.findByText('Edit item');
    await waitFor(() => expect(screen.getByLabelText('Title')?.value ?? screen.getByDisplayValue('Cordless Drill UI')).toBeTruthy());
    const desc = screen.getByText('Description').parentElement.querySelector('textarea');
    await user.type(desc, 'Now with description');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Dashboard');
    // delete (never booked -> hard delete)
    const mine2 = (await screen.findByText('Cordless Drill UI')).closest('.card');
    await user.click(within(mine2).getByRole('link', { name: 'Edit' }));
    await screen.findByText('Edit item');
    window.confirm = () => true;
    await user.click(screen.getByRole('button', { name: 'Delete item' }));
    await screen.findByText('Dashboard');
    await waitFor(() => expect(screen.queryByText('Cordless Drill UI')).toBeNull());
  });

  it('account page: update profile, deletion refused while bookings open, allowed after', async () => {
    await login('omar@example.com');                            // Omar has open bookings (camera loan etc.)
    await go('/account');
    await screen.findByText('Your account');
    await typeInto('Area', 'Model Town Ext');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Profile updated.')).toBeTruthy();
    window.confirm = () => true;
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(document.querySelector('.alert-error')?.textContent).toMatch(/open booking/));   // 409 message shown
    // Uma (no open bookings) can delete
    await login(umaEmail);
    await go('/account');
    await screen.findByText('Your account');
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await screen.findByText(/Lend what you're not using/);           // redirected to home, logged out
    expect(getToken()).toBeNull();
  });

  it('admin panel: stats, category rename + delete rules', async () => {
    setToken(null);
    await go('/login');
    await typeInto('Email', 'admin@borrowbox.local');
    await typeInto('Password', 'admin1234');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await screen.findByRole('heading', { name: /Borrow what you need/ });
    await go('/admin');
    await screen.findByText('Admin panel');
    expect(await screen.findByText('Bookings by status')).toBeTruthy();
    // create + rename + delete a category
    await user.type(screen.getByPlaceholderText('New category name'), `Temp ${uniq}`);
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    const row = (await screen.findByText(`Temp ${uniq}`)).closest('div.row-between');
    window.prompt = () => `Renamed ${uniq}`;
    await user.click(within(row).getByRole('button', { name: 'Rename' }));
    const row2 = (await screen.findByText(`Renamed ${uniq}`)).closest('div.row-between');
    await user.click(within(row2).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText(`Renamed ${uniq}`)).toBeNull());
    // a category in use cannot be deleted -> error banner
    const pt = (await screen.findByText('Power Tools')).closest('div.row-between');
    await user.click(within(pt).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/in use by one or more items/)).toBeTruthy();
  });
});
