# BorrowBox

A peer-to-peer lending platform: neighbours lend tools and gadgets they are not using, and borrow what they need.

## How to run

Requires Node.js and PostgreSQL (running).

Backend (creates the database, tables and sample data automatically):

```bash
cd server
npm install
npm run dev
```

Frontend (in a second terminal):

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

If your PostgreSQL password is not `postgres`, edit `DATABASE_URL` in `server/.env`.

## Demo logins

| Role | Email | Password |
|---|---|---|
| Admin | admin@borrowbox.local | admin1234 |
| Member | ali@example.com | password123 |
| Member | sara@example.com | password123 |
| Member | omar@example.com | password123 |

## Screenshots

### Home
Search by keyword and dates, then filter by category and condition.

![Home page](screenshots/01-home.png)

### Browse items
Item cards show a photo, category, availability, maximum loan days, rating and pickup area.

![Browse electronics and party items](screenshots/02-browse-electronics-party.png)

Results are paginated (12 per page).

![Browse camping items with pagination](screenshots/03-browse-camping-pagination.png)

### Categories
Eight categories with three items each.

![Categories page](screenshots/04-categories.png)

### Log in and sign up

![Log in](screenshots/05-login.png)

![Create an account](screenshots/06-sign-up.png)

### Admin panel
Platform totals and bookings by status.

![Admin panel](screenshots/07-admin-panel.png)

Manage users (activate or deactivate) and categories (add, rename, delete).

![Admin users and categories](screenshots/08-admin-users-categories.png)

### Member dashboard
Track items you borrow and cancel pending requests.

![Dashboard, my borrowings](screenshots/09-dashboard-borrowings.png)

Manage requests for your own items: approve, hand over, and mark returned.

![Dashboard, incoming requests](screenshots/10-dashboard-incoming-requests.png)
