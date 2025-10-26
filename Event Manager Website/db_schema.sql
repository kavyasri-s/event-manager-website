
-- This makes sure that foreign_key constraints are observed and that errors will be thrown for violations
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

-- site settings table
-- table stores global settings for website
-- input: site_name (TEXT) and description (TEXT)
-- output: used across pages like the home pages

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  site_name TEXT NOT NULL,
  description TEXT NOT NULL
);

-- insert default site settings (only one row allowed)
INSERT INTO site_settings (id, site_name, description)
VALUES (1, 'FreshAir Fitness', 'Elevate Your Workout, Embrace the Outdoors');

-- events table
-- stores all event info created by organiser
-- input: title, description, date, time
-- output: displayed to organiser and attendee pages

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT,
  time TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  last_modified TEXT,
  is_published INTEGER DEFAULT 0
);

-- insert sample events (published and draft events)
INSERT INTO events (title, description, date, time, is_published, published_at, created_at)
VALUES 
  ('Sunrise Yoga Flow', 'Gentle yoga at dawn to energize your body and calm your mind', '2025-07-10', '07:00', 1, '2025-06-28 15:30:25', '2025-06-20 10:12:00'),
  ('Eco-Workout Bootcamp', 'Outdoor bodyweight exercises using natural surroundings', '2025-08-15', '18:00', 0, NULL, '2025-06-25 14:30:00'),
  ('Mindful Mountain Hike', 'Hike scenic trails with meditation breaks for clarity and calm', '2025-07-20', '16:00', 1, '2025-06-29 13:42:53', '2025-06-22 08:45:00');

-- tickets table
-- stores ticket types and quantities for each event (full/concession)
-- input: ticket_type, price, quantity, original_quantity
-- output: displayed in organiser home and used for booking by attendees too

CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    ticket_type TEXT NOT NULL, -- 'full' or 'concession'
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    original_quantity INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- insert sample ticket data for existing events
INSERT INTO tickets (event_id, ticket_type, price, quantity, original_quantity) VALUES 
(1, 'full', 30.00, 15, 15),
(1, 'concession', 20.00, 10, 10),
(2, 'full', 30.00, 15, 15),
(2, 'concession', 20.00, 10, 10),
(3, 'full', 30.00, 15, 15),
(3, 'concession', 20.00, 10, 10);


COMMIT;

