
const express = require('express');
const router = express.Router();

/*GET /
purpose: render the attendee home page with published events
input: none (retrieves data from database)
output: renders attendee-home..ejs with site settings and all published events and tickets*/

router.get('/', (req, res) => {
  const settingsSQL = `SELECT * FROM site_settings WHERE id = 1`;
  const eventsSQL = `SELECT * FROM events WHERE is_published = 1 ORDER BY date ASC`;
  const ticketsSQL = `SELECT * FROM tickets`;

//fetch site settings
  global.db.get(settingsSQL, [], (err, settings) => {
    if (err || !settings) {
      console.error("Error fetching site settings:", err?.message || "Not found.");
      return res.status(500).send("Error loading site settings.");
    }

//fetch published events
    global.db.all(eventsSQL, [], (err2, events) => {
      if (err2) {
        console.error("Error fetching events:", err2.message);
        return res.status(500).send("Database error.");
      }

//fetch all tickets
      global.db.all(ticketsSQL, [], (err3, tickets) => {
        if (err3) {
          console.error("Error fetching tickets:", err3.message);
          return res.status(500).send("Error loading tickets.");
        }

//organise tickets by event ID
        const ticketMap = {};
        tickets.forEach(ticket => {
          if (!ticketMap[ticket.event_id]) ticketMap[ticket.event_id] = [];
          ticketMap[ticket.event_id].push({
            ticket_type: ticket.ticket_type,
            price: parseFloat(ticket.price),
            remaining: ticket.quantity,
            original: ticket.original_quantity
          });
        });

//attach corresponding tickets to each event
        events.forEach(event => {
          event.tickets = ticketMap[event.id] || [];
        });

//render attendee home page
        res.render('attendee-home', {
          siteName: settings.site_name,
          description: settings.description,
          publishedEvents: events
        });
      });
    });
  });
});

/*GET /event/:id
purpose: render the event details page for attendees
input: 
- id is event ID from url parameter
- req.query.error is error message passed from booking form
output: renders attendee-event.ejs with event info, tickets and possibly error msg*/

router.get('/event/:id', (req, res) => {
  const eventId = req.params.id;

  const eventSQL = `SELECT * FROM events WHERE id = ? AND is_published = 1`;
  const ticketsSQL = `SELECT * FROM tickets WHERE event_id = ?`;

//read possible error message
  const error = req.query.error || null;

//fetch the event
  global.db.get(eventSQL, [eventId], (err, event) => {
    if (err || !event) {
      console.error("Event not found or unpublished:", err?.message || "No event.");
      return res.status(404).send("Event not found.");
    }

//fetch associated tickets
    global.db.all(ticketsSQL, [eventId], (err2, tickets) => {
      if (err2) {
        console.error("Error fetching tickets:", err2.message);
        return res.status(500).send("Error loading tickets.");
      }

//format ticket data
      tickets.forEach(t => {
        t.price = parseFloat(t.price);
        t.remaining = t.quantity;
        t.original = t.original_quantity;
      });

//render attendee event page
      res.render('attendee-event', {
        event,
        tickets,
        error
      });
    });
  });
});

/*POST /book/:id
purpose: handle attendee ticket booking submission
input:
- :id is the event ID from url
- req.body.attendee_name is the attendee's name
- req.body.attendee_email is the attendee's email
- req.body.quantity_full is the qty of full price tickets
- req.body.quantity_concession is the qty of concession price tickets
output:
- if error then redirect back to event page with error msg
- if success then render booking-confirmed.ejs*/

router.post('/book/:id', (req, res) => {
  const eventId = req.params.id;
  const attendeeName = req.body.attendee_name?.trim();
  const attendeeEmail = req.body.attendee_email?.trim();

  const quantityFull = parseInt(req.body.quantity_full) || 0;
  const quantityConcession = parseInt(req.body.quantity_concession) || 0;

//validate attendee's name
  if (!attendeeName) {
    return res.redirect(`/attendee/event/${eventId}?error=Please enter your name`);
  }

//validate attendee email address
  if (!attendeeEmail) {
    return res.redirect(`/attendee/event/${eventId}?error=Please enter your email address`);
  }

//basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(attendeeEmail)) {
    return res.redirect(`/attendee/event/${eventId}?error=Please enter a valid email address`);
  }

//validate at least one ticket selected
  if (quantityFull + quantityConcession === 0) {
    return res.redirect(`/attendee/event/${eventId}?error=Please select at least one ticket to book`);
  }

  const ticketSQL = `SELECT * FROM tickets WHERE event_id = ?`;

//fetch ticket info for the event
  global.db.all(ticketSQL, [eventId], (err, tickets) => {
    if (err) {
      console.error("Error checking tickets:", err.message);
      return res.status(500).send("Error checking ticket availability.");
    }

    const fullTicket = tickets.find(t => t.ticket_type === 'full');
    const concessionTicket = tickets.find(t => t.ticket_type === 'concession');

//check if enough tickets are available
    if ((quantityFull > (fullTicket?.quantity || 0)) || (quantityConcession > (concessionTicket?.quantity || 0))) {
      return res.redirect(`/attendee/event/${eventId}?error=Not enough tickets available. Please select fewer tickets.`);
    }

// SQL to update ticket quantities
    const updateSQL = `UPDATE tickets SET quantity = quantity - ? WHERE event_id = ? AND ticket_type = ?`;

//deduct full price tickets
    global.db.run(updateSQL, [quantityFull, eventId, 'full'], function (err1) {
      if (err1) {
        console.error("Error updating full tickets:", err1.message);
        return res.status(500).send("Booking error.");
      }

//deduct concession tickets
      global.db.run(updateSQL, [quantityConcession, eventId, 'concession'], function (err2) {
        if (err2) {
          console.error("Error updating concession tickets:", err2.message);
          return res.status(500).send("Booking error.");
        }

//retrieve event title to confirm booking
        const eventSQL = `SELECT title FROM events WHERE id = ? LIMIT 1`;
        global.db.get(eventSQL, [eventId], (err3, event) => {
          const eventTitle = event?.title || 'the event';
          
//render booking confirmation
          res.render('booking-confirmed', {
            attendeeName,
            eventTitle
          });
        });
      });
    });
  });
});

module.exports = router;