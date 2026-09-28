-- =====================================================================
-- BorrowBox - PostgreSQL schema (Section 08: Database Design)
--
-- Six tables:  users, categories, items, bookings, condition_logs, reviews
--
-- Relationships
--   users 1-N items            (an owner lists many items)
--   categories 1-N items
--   items 1-N bookings
--   users 1-N bookings         (as borrower)
--   bookings 1-N condition_logs (at most 2: handover + return)
--   bookings 1-N reviews        (at most 2: one per side)
--
-- The trust score is NOT stored. It is calculated on read with
-- AVG(rating) over reviews where reviewee_id = the user.
--
-- Usage:   psql -d borrowbox -f src/db/schema.sql
--    or:   npm run db:schema
--
-- NOTE: this script DROPS and re-creates every table so it can be re-run
-- while developing. Do not run it against a database holding real data.
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS reviews        CASCADE;
DROP TABLE IF EXISTS condition_logs CASCADE;
DROP TABLE IF EXISTS bookings       CASCADE;
DROP TABLE IF EXISTS items          CASCADE;
DROP TABLE IF EXISTS categories     CASCADE;
DROP TABLE IF EXISTS users          CASCADE;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id             SERIAL       PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,          -- bcrypt hash, never the password
    phone          VARCHAR(30),
    area           VARCHAR(100),
    role           VARCHAR(10)  NOT NULL DEFAULT 'member'
                   CHECK (role IN ('member', 'admin')),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,   -- FALSE = soft-deleted / deactivated
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id    SERIAL       PRIMARY KEY,
    name  VARCHAR(80)  NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------
CREATE TABLE items (
    id            SERIAL       PRIMARY KEY,
    owner_id      INTEGER      NOT NULL REFERENCES users(id),
    category_id   INTEGER      NOT NULL REFERENCES categories(id),
    title         VARCHAR(150) NOT NULL,
    description   TEXT,
    condition     VARCHAR(10)  NOT NULL DEFAULT 'good'
                  CHECK (condition IN ('new', 'good', 'fair')),
    max_days      INTEGER      NOT NULL CHECK (max_days > 0),
    pickup_area   VARCHAR(100),
    image_url     TEXT,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_owner    ON items (owner_id);
CREATE INDEX idx_items_category ON items (category_id);

-- ---------------------------------------------------------------------
-- bookings
-- status flow:  REQUESTED -> APPROVED -> PICKED_UP -> RETURNED
--               REQUESTED -> REJECTED
--               REQUESTED | APPROVED -> CANCELLED
-- (the allowed transitions are enforced by the API, see booking.controller.js)
-- ---------------------------------------------------------------------
CREATE TABLE bookings (
    id             SERIAL       PRIMARY KEY,
    item_id        INTEGER      NOT NULL REFERENCES items(id),
    borrower_id    INTEGER      NOT NULL REFERENCES users(id),
    start_date     DATE         NOT NULL,
    end_date       DATE         NOT NULL,
    status         VARCHAR(12)  NOT NULL DEFAULT 'REQUESTED'
                   CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED',
                                     'CANCELLED', 'PICKED_UP', 'RETURNED')),
    message        TEXT,
    reject_reason  TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CHECK (end_date >= start_date)
);

-- Backs the date-overlap query (the heart of the project)
CREATE INDEX idx_bookings_item_status ON bookings (item_id, status);
CREATE INDEX idx_bookings_borrower    ON bookings (borrower_id);

-- ---------------------------------------------------------------------
-- condition_logs  - condition note at handover and at return
-- ---------------------------------------------------------------------
CREATE TABLE condition_logs (
    id          SERIAL       PRIMARY KEY,
    booking_id  INTEGER      NOT NULL REFERENCES bookings(id),
    stage       VARCHAR(10)  NOT NULL CHECK (stage IN ('handover', 'return')),
    note        TEXT,
    logged_by   INTEGER      NOT NULL REFERENCES users(id),
    logged_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (booking_id, stage)
);

-- ---------------------------------------------------------------------
-- reviews  - both sides rate each other after RETURNED
-- ---------------------------------------------------------------------
CREATE TABLE reviews (
    id           SERIAL       PRIMARY KEY,
    booking_id   INTEGER      NOT NULL REFERENCES bookings(id),
    reviewer_id  INTEGER      NOT NULL REFERENCES users(id),
    reviewee_id  INTEGER      NOT NULL REFERENCES users(id),
    rating       INTEGER      NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (booking_id, reviewer_id),
    CHECK (reviewer_id <> reviewee_id)
);

CREATE INDEX idx_reviews_reviewee ON reviews (reviewee_id);

COMMIT;
