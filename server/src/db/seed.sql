-- =====================================================================
-- BorrowBox - sample data
--
-- Run AFTER schema.sql on an empty database:
--     psql -d borrowbox -f src/db/seed.sql        (or: npm run db:seed)
--
-- Logins (change these before deploying anywhere real):
--     admin@borrowbox.local   /  admin1234      (admin)
--     ali@example.com         /  password123    (member - owns items)
--     sara@example.com        /  password123    (member - borrower)
--     omar@example.com        /  password123    (member)
--
-- All booking dates are relative to CURRENT_DATE so the data never goes stale.
-- What the data lets you demo straight away:
--   * Ali's drill has TWO overlapping REQUESTED bookings (Sara, Omar).
--     Approve Sara's and Omar's is auto-rejected in the same transaction.
--   * Omar still holds Sara's camera and it is past its end_date -> OVERDUE flag.
--   * Two RETURNED bookings with condition logs and two-way reviews -> trust scores.
--   * Sara has a CANCELLED and a REJECTED booking she can edit/delete.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- users   (bcrypt, 10 rounds)
-- ---------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, phone, area, role) VALUES
  ('Platform Admin', 'admin@borrowbox.local', '$2b$10$FJbVU.KTDNS8LEy5kMQrNOJ94JJJZCNP8/iIB2vjtSzwNazI7Hi62', NULL,            NULL,           'admin'),
  ('Ali Khan',       'ali@example.com',       '$2b$10$fMVAbpC039t4aq.gzU2VZ.VUe1Io7nlqAiJ2.L2z74taCJKl07FTe', '0300-1111111', 'DHA Phase 5',  'member'),
  ('Sara Ahmed',     'sara@example.com',      '$2b$10$fMVAbpC039t4aq.gzU2VZ.VUe1Io7nlqAiJ2.L2z74taCJKl07FTe', '0300-2222222', 'Gulberg III',  'member'),
  ('Omar Sheikh',    'omar@example.com',      '$2b$10$fMVAbpC039t4aq.gzU2VZ.VUe1Io7nlqAiJ2.L2z74taCJKl07FTe', '0300-3333333', 'Model Town',   'member');

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
INSERT INTO categories (name) VALUES
  ('Power Tools'),
  ('Hand Tools'),
  ('Ladders & Access'),
  ('Photography'),
  ('Camping & Outdoors'),
  ('Party & Events'),
  ('Electronics'),
  ('Garden & Yard');

-- ---------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------
INSERT INTO items (owner_id, category_id, title, description, condition, max_days, pickup_area, image_url)
SELECT u.id, c.id, v.title, v.description, v.condition, v.max_days, v.pickup_area, v.image_url
FROM (VALUES
  ('ali@example.com', 'Power Tools', 'Cordless Drill', 'Bosch 18V drill/driver with two batteries and a charger. Bits not included.', 'good', 5, 'DHA Phase 5', 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80&auto=format&fit=crop'),
  ('ali@example.com', 'Ladders & Access', 'Extension Ladder', '3.5 m aluminium extension ladder. Fits in a hatchback.', 'fair', 3, 'DHA Phase 5', 'https://images.unsplash.com/photo-1617515457325-728e2a50cd87?w=800&q=80&auto=format&fit=crop'),
  ('sara@example.com', 'Photography', 'DSLR Camera Kit', 'Canon DSLR body, 18-55 mm lens, strap and two batteries.', 'good', 3, 'Gulberg III', 'https://images.unsplash.com/photo-1549449709-c74021f9fc2c?w=800&q=80&auto=format&fit=crop'),
  ('sara@example.com', 'Camping & Outdoors', '4-Person Tent', 'Waterproof dome tent, sets up in ten minutes. Pegs and poles included.', 'good', 7, 'Gulberg III', 'https://images.unsplash.com/photo-1669131723907-305f46ca8ffe?w=800&q=80&auto=format&fit=crop'),
  ('omar@example.com', 'Electronics', 'Portable Projector', 'HD mini projector with HDMI cable and tripod.', 'new', 2, 'Model Town', 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80&auto=format&fit=crop'),
  ('omar@example.com', 'Garden & Yard', 'Petrol Lawn Mower', 'Self-propelled mower, 40 cm cutting width. Bring your own fuel.', 'fair', 2, 'Model Town', 'https://images.unsplash.com/photo-1629335493470-f22db7852d39?w=800&q=80&auto=format&fit=crop'),
  ('ali@example.com', 'Power Tools', 'Angle Grinder', '115 mm angle grinder with guard and two cutting discs. Wear eye protection.', 'good', 3, 'DHA Phase 5', 'https://images.unsplash.com/photo-1738162837672-de9d735a9b90?w=800&q=80&auto=format&fit=crop'),
  ('sara@example.com', 'Power Tools', 'Cordless Impact Driver', '18V impact driver with battery and fast charger. Great for decking and heavy screws.', 'good', 4, 'Gulberg III', 'https://images.unsplash.com/photo-1546827209-a218e99fdbe9?w=800&q=80&auto=format&fit=crop'),
  ('omar@example.com', 'Hand Tools', 'Claw Hammer', '16 oz steel claw hammer with a shock-absorbing grip.', 'good', 5, 'Model Town', 'https://images.unsplash.com/photo-1586864387789-628af9feed72?w=800&q=80&auto=format&fit=crop'),
  ('ali@example.com', 'Hand Tools', 'Wrench Set', 'Adjustable wrench and pipe wrench pair for plumbing and general repairs.', 'good', 7, 'DHA Phase 5', 'https://images.unsplash.com/photo-1503789146722-cf137a3c0fea?w=800&q=80&auto=format&fit=crop'),
  ('sara@example.com', 'Hand Tools', 'Carpentry Hand Tool Set', 'Chisels, marking tools and hand saw for small woodworking jobs.', 'good', 5, 'Gulberg III', 'https://images.unsplash.com/photo-1567361808960-dec9cb578182?w=800&q=80&auto=format&fit=crop'),
  ('omar@example.com', 'Ladders & Access', 'A-Frame Step Ladder', 'Sturdy 6-step A-frame ladder, ideal for painting and changing ceiling lights.', 'good', 3, 'Model Town', 'https://images.unsplash.com/photo-1549030782-4935f80baeb6?w=800&q=80&auto=format&fit=crop'),
  ('sara@example.com', 'Ladders & Access', 'Wooden Garden Ladder', 'Traditional wooden ladder, good for fruit picking and pruning.', 'fair', 3, 'Gulberg III', 'https://images.unsplash.com/photo-1519963759188-0e9264cd7992?w=800&q=80&auto=format&fit=crop'),
  ('omar@example.com', 'Photography', 'Mirrorless Camera Body', '24 MP mirrorless camera body with two batteries and an SD card.', 'good', 3, 'Model Town', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80&auto=format&fit=crop'),
  ('ali@example.com', 'Photography', '50mm Prime Lens', 'Fast 50 mm f/1.8 prime lens, perfect for portraits. Includes front and rear caps.', 'new', 3, 'DHA Phase 5', 'https://images.unsplash.com/photo-1721310334467-c74e9eacfb91?w=800&q=80&auto=format&fit=crop'),
  ('ali@example.com', 'Camping & Outdoors', 'Hiking Backpack 60L', '60-litre trekking backpack with rain cover and padded hip belt.', 'good', 7, 'DHA Phase 5', 'https://images.unsplash.com/photo-1622260614153-03223fb72052?w=800&q=80&auto=format&fit=crop'),
  ('omar@example.com', 'Camping & Outdoors', 'Folding Camping Chair', 'Lightweight folding chair that packs into a carry bag.', 'good', 7, 'Model Town', 'https://images.unsplash.com/photo-1535530124635-c5487dfad499?w=800&q=80&auto=format&fit=crop'),
  ('omar@example.com', 'Party & Events', 'Party Speaker', 'Loud portable Bluetooth party speaker with LED lights. About 12 hours of battery.', 'good', 2, 'Model Town', 'https://images.unsplash.com/photo-1589256469067-ea99122bbdc4?w=800&q=80&auto=format&fit=crop'),
  ('sara@example.com', 'Party & Events', 'Outdoor String Lights', '10 m warm-white festoon lights for garden parties and weddings.', 'new', 3, 'Gulberg III', 'https://images.unsplash.com/photo-1546373702-eb3e6f769df2?w=800&q=80&auto=format&fit=crop'),
  ('ali@example.com', 'Party & Events', 'Party Gazebo Canopy', '3 x 3 m gazebo with curtains. Two people can set it up in 15 minutes.', 'good', 2, 'DHA Phase 5', 'https://images.unsplash.com/photo-1527359443443-84a48aec73d2?w=800&q=80&auto=format&fit=crop'),
  ('sara@example.com', 'Electronics', 'Bluetooth Speaker', 'Portable water-resistant Bluetooth speaker with charging cable.', 'good', 4, 'Gulberg III', 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=80&auto=format&fit=crop'),
  ('ali@example.com', 'Electronics', 'Smart Home Speaker', 'Voice-controlled smart speaker with power adapter. Needs Wi-Fi.', 'good', 5, 'DHA Phase 5', 'https://images.unsplash.com/photo-1529359744902-86b2ab9edaea?w=800&q=80&auto=format&fit=crop'),
  ('sara@example.com', 'Garden & Yard', 'String Trimmer', 'Petrol string trimmer for edges and tall grass. Bring your own fuel.', 'good', 2, 'Gulberg III', 'https://images.unsplash.com/photo-1689728318937-17d24bc0a65c?w=800&q=80&auto=format&fit=crop'),
  ('ali@example.com', 'Garden & Yard', 'Garden Wheelbarrow', 'Heavy-duty wheelbarrow with a pneumatic tyre, good for soil and rubble.', 'fair', 3, 'DHA Phase 5', 'https://images.unsplash.com/photo-1556413084-41a81ea2ade7?w=800&q=80&auto=format&fit=crop')
) AS v(owner_email, category, title, description, condition, max_days, pickup_area, image_url)
JOIN users      u ON u.email = v.owner_email
JOIN categories c ON c.name  = v.category;

-- ---------------------------------------------------------------------
-- bookings   (start/end are day offsets from today)
-- ---------------------------------------------------------------------
INSERT INTO bookings (item_id, borrower_id, start_date, end_date, status, message, reject_reason)
SELECT i.id, b.id, CURRENT_DATE + v.start_off, CURRENT_DATE + v.end_off, v.status, v.message, v.reject_reason
FROM (VALUES
  -- finished loans (reviews + condition logs below)
  ('Cordless Drill',     'sara@example.com', -12, -10, 'RETURNED',  'Hanging shelves in the study.',                    NULL),
  ('Extension Ladder',   'omar@example.com',  -8,  -6, 'RETURNED',  'Cleaning the gutters.',                            NULL),
  -- still out and past its end_date  ->  OVERDUE flag
  ('DSLR Camera Kit',    'omar@example.com',  -5,  -2, 'PICKED_UP', 'Cousin''s engagement photos.',                     NULL),
  -- approved for the future
  ('Portable Projector', 'sara@example.com',   3,   4, 'APPROVED',  'Movie night with the family.',                     NULL),
  -- two clashing requests for the same drill: approving one auto-rejects the other
  ('Cordless Drill',     'sara@example.com',   6,   8, 'REQUESTED', 'Need it for a weekend furniture assembly.',        NULL),
  ('Cordless Drill',     'omar@example.com',   7,   9, 'REQUESTED', 'Putting up curtain rails.',                        NULL),
  -- things Sara can edit / clean up
  ('4-Person Tent',      'sara@example.com',  10,  12, 'CANCELLED', 'Camping trip - plans changed.',                    NULL),
  ('4-Person Tent',      'omar@example.com',  14,  16, 'REJECTED',  'Family camping weekend.',                          'Sorry, I am away that weekend.')
) AS v(item_title, borrower_email, start_off, end_off, status, message, reject_reason)
JOIN items i ON i.title = v.item_title
JOIN users b ON b.email = v.borrower_email;

-- ---------------------------------------------------------------------
-- condition_logs   (the item's owner records both stages)
-- ---------------------------------------------------------------------
INSERT INTO condition_logs (booking_id, stage, note, logged_by)
SELECT bk.id, v.stage, v.note, i.owner_id
FROM (VALUES
  ('Cordless Drill',   'sara@example.com', 'RETURNED',  'handover', 'Fully charged, one small scratch on the handle.'),
  ('Cordless Drill',   'sara@example.com', 'RETURNED',  'return',   'Returned clean, same scratch as before.'),
  ('Extension Ladder', 'omar@example.com', 'RETURNED',  'handover', 'All rungs sound, feet intact.'),
  ('Extension Ladder', 'omar@example.com', 'RETURNED',  'return',   'Returned as given.'),
  ('DSLR Camera Kit',  'omar@example.com', 'PICKED_UP', 'handover', 'Body and lens clean, strap and two batteries included.')
) AS v(item_title, borrower_email, status, stage, note)
JOIN items    i  ON i.title = v.item_title
JOIN users    bu ON bu.email = v.borrower_email
JOIN bookings bk ON bk.item_id = i.id AND bk.borrower_id = bu.id AND bk.status = v.status;

-- ---------------------------------------------------------------------
-- reviews   (side = who is writing: the borrower or the item's owner)
-- ---------------------------------------------------------------------
INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment)
SELECT bk.id,
       CASE v.side WHEN 'borrower' THEN bk.borrower_id ELSE i.owner_id    END,
       CASE v.side WHEN 'borrower' THEN i.owner_id    ELSE bk.borrower_id END,
       v.rating, v.comment
FROM (VALUES
  ('Cordless Drill',   'sara@example.com', 'borrower', 5, 'Smooth handover, drill worked perfectly.'),
  ('Cordless Drill',   'sara@example.com', 'owner',    5, 'Returned on time and spotless.'),
  ('Extension Ladder', 'omar@example.com', 'borrower', 4, 'Ladder is a bit wobbly on the top rung, but Ali was very helpful.'),
  ('Extension Ladder', 'omar@example.com', 'owner',    5, 'Careful borrower, would lend to again.')
) AS v(item_title, borrower_email, side, rating, comment)
JOIN items    i  ON i.title = v.item_title
JOIN users    bu ON bu.email = v.borrower_email
JOIN bookings bk ON bk.item_id = i.id AND bk.borrower_id = bu.id AND bk.status = 'RETURNED';

COMMIT;
