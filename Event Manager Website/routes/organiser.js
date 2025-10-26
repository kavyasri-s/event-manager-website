
//organiser.js
//handles organiser routes for creating, editing, deleting and publishing events

const express = require('express');
const router = express.Router();

/*GET /
purpose: display the organiser homepage with lists of all draft and published events
input: none as it reads from database (site settings, events and tickets)
output: renders organiser-home.ejs with grouped event data and settings*/

router.get('/', (req, res) => {
  // Get site settings from database
  global.db.get(`SELECT * FROM site_settings WHERE id = 1`, (err, settings) => {
    if (err) {
      console.error("Error fetching site settings:", err.message);
      return res.status(500).send("Failed to load site settings.");
    }

    const eventsQuery = `SELECT * FROM events ORDER BY date ASC`;
    global.db.all(eventsQuery, [], (err, allEvents) => {
      if (err) {
        console.error("Error fetching events:", err.message);
        return res.status(500).send("Error loading events.");
      }

      const ticketsQuery = `SELECT * FROM tickets`;
      global.db.all(ticketsQuery, [], (err2, allTickets) => {
        if (err2) {
          console.error("Error fetching tickets:", err2.message);
          return res.status(500).send("Error loading tickets.");
        }

//group tickets by event ID
        const ticketMap = {};
        allTickets.forEach(ticket => {
          if (!ticketMap[ticket.event_id]) {
            ticketMap[ticket.event_id] = [];
          }
          ticketMap[ticket.event_id].push(ticket);
        });

        const publishedEvents = [];
        const draftEvents = [];

//groups events by publication status and attach their tickets
        allEvents.forEach(event => {
          event.tickets = ticketMap[event.id] || [];
          event.tickets.forEach(ticket => {
            ticket.price = parseFloat(ticket.price);
            ticket.remaining = ticket.quantity;
            ticket.original = ticket.original_quantity || ticket.quantity;
          });

          if (event.is_published) {
            publishedEvents.push(event);
          } else {
            draftEvents.push(event);
          }
        });

        res.render('organiser-home', {
          siteName: settings.site_name,
          description: settings.description,
          publishedEvents,
          draftEvents
        });
      });
    });
  });
});

/*GET /new
purpose: render blank form for creating new event
input: none
output: renders edit-event.ejs with empty fields*/

router.get('/new', (req, res) => {
  res.render('edit-event', {
    event: {
      id: null,
      title: '',
      description: '',
      date: '',
      time: '',
      created_at: 'Will be set after creation'
    },
    fullTicket: { quantity: '', price: '' },
    concessionTicket: { quantity: '', price: '' },
    error: null
  });
});

/*POST /new
purpose: handles submission of new event form and insert into database
input: req.body (form fields of event info and ticket types)
output: if success then redirect to organiser homepg, otherwise if error then re-render form with error msg*/

router.post('/new', (req, res) => {
  const {
    title,
    description,
    date,
    time,
    full_price,
    full_quantity,
    concession_price,
    concession_quantity
  } = req.body;

//validate required fields
  if (!title || !date || !time || !full_price || !full_quantity || !concession_price || !concession_quantity) {
    return res.render('edit-event', {
      event: {
        id: null,
        title,
        description,
        date,
        time,
        created_at: 'Will be set after creation'
      },
      fullTicket: { quantity: full_quantity, price: full_price },
      concessionTicket: { quantity: concession_quantity, price: concession_price },
      error: "Please fill in all required fields."
    });
  }

//insert event as draft where is_published = 0
  const insertEventSQL = `
    INSERT INTO events (title, description, date, time, is_published)
    VALUES (?, ?, ?, ?, 0)
  `;
  global.db.run(insertEventSQL, [title, description, date, time], function (err) {
    if (err) {
      console.error("Error creating event:", err.message);
      return res.status(500).send("Failed to create event.");
    }

    const newEventId = this.lastID;

//insert both ticket types
    const insertTicketSQL = `
      INSERT INTO tickets (event_id, ticket_type, price, quantity, original_quantity)
      VALUES (?, ?, ?, ?, ?)
    `;
    global.db.run(insertTicketSQL, [newEventId, 'full', full_price, full_quantity, full_quantity]);
    global.db.run(insertTicketSQL, [newEventId, 'concession', concession_price, concession_quantity, concession_quantity]);

    res.redirect('/organiser');
  });
});

/*GET /edit/:id
purpose: render form pre filled with event and ticket info for editing
input: :id which is event ID from url
output: renders edit-event.ejs with existing event data*/

router.get('/edit/:id', (req, res) => {
  const eventId = req.params.id;

  const eventQuery = `SELECT * FROM events WHERE id = ?`;
  const ticketQuery = `SELECT * FROM tickets WHERE event_id = ?`;

  global.db.get(eventQuery, [eventId], (err, event) => {
    if (err || !event) {
      console.error("Error loading event:", err?.message || "Event not found.");
      return res.status(404).send("Event not found.");
    }

    global.db.all(ticketQuery, [eventId], (err2, tickets) => {
      if (err2) {
        console.error("Error loading tickets:", err2.message);
        return res.status(500).send("Error loading tickets.");
      }

      const fullTicket = tickets.find(t => t.ticket_type === 'full') || { quantity: '', price: '' };
      const concessionTicket = tickets.find(t => t.ticket_type === 'concession') || { quantity: '', price: '' };

      res.render('edit-event', {
        event,
        fullTicket,
        concessionTicket,
        error: null
      });
    });
  });
});

/*POST /edit/:id
purpose: handle form submission for editing and event and updating database
input: :
- id (event ID)
- req.body (updated form fields)
output: if success then redirect to organiser homepg otherwise if error then send error msg*/

router.post('/edit/:id', (req, res) => {
  const eventId = req.params.id;
  const {
    title,
    description,
    date,
    time,
    full_price,
    full_quantity,
    concession_price,
    concession_quantity
  } = req.body;

  if (!title || !date || !time || !full_price || !full_quantity || !concession_price || !concession_quantity) {
    return res.send("Please fill in all required fields.");
  }

  const updateEventSQL = `
    UPDATE events
    SET title = ?, description = ?, date = ?, time = ?, last_modified = datetime('now')
    WHERE id = ?
  `;

  global.db.run(updateEventSQL, [title, description, date, time, eventId], function (err) {
    if (err) {
      console.error("Error updating event:", err.message);
      return res.status(500).send("Failed to update event");
    }

    const deleteTicketsSQL = `DELETE FROM tickets WHERE event_id = ?`;
    global.db.run(deleteTicketsSQL, [eventId], function (err2) {
      if (err2) {
        console.error("Error deleting tickets:", err2.message);
        return res.status(500).send("Failed to reset tickets");
      }

      const insertTicketSQL = `
        INSERT INTO tickets (event_id, ticket_type, price, quantity, original_quantity)
        VALUES (?, ?, ?, ?, ?)
      `;
      global.db.run(insertTicketSQL, [eventId, 'full', full_price, full_quantity, full_quantity]);
      global.db.run(insertTicketSQL, [eventId, 'concession', concession_price, concession_quantity, concession_quantity]);

      res.redirect('/organiser');
    });
  });
});

/*POST /delete/:id
purpose: delete event and its associated tickets
input: :id which is event ID
output: redirect to organiser homepage aft deleting*/

router.post('/delete/:id', (req, res) => {
  const eventId = req.params.id;

  const deleteTicketsSQL = `DELETE FROM tickets WHERE event_id = ?`;
  const deleteEventSQL = `DELETE FROM events WHERE id = ?`;

  global.db.run(deleteTicketsSQL, [eventId], function (err) {
    if (err) {
      console.error("Error deleting tickets:", err.message);
      return res.status(500).send("Failed to delete tickets.");
    }

    global.db.run(deleteEventSQL, [eventId], function (err2) {
      if (err2) {
        console.error("Error deleting event:", err2.message);
        return res.status(500).send("Failed to delete event.");
      }

      res.redirect('/organiser');
    });
  });
});

/*POST /publish/:id
purpose: mark draft event as published and record published time
input: :id which is event ID
output: redirect to organiser homepage aft publishing*/

router.post('/publish/:id', (req, res) => {
  const eventId = req.params.id;
  const publishSQL = `
    UPDATE events
    SET is_published = 1,
        published_at = datetime('now')
    WHERE id = ?
  `;
  global.db.run(publishSQL, [eventId], function (err) {
    if (err) {
      console.error("Error publishing event:", err.message);
      return res.status(500).send("Failed to publish event.");
    }
    res.redirect('/organiser');
  });
});

module.exports = router;