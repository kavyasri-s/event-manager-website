
//siteSettings.js
//handles viewing and updating site name and description

const express = require('express');
const router = express.Router();

/*GET /
purpose: display the site settings form to organiser
input: none as it reads site settings from database
output: renders site-settings.ejs with the current settings*/

router.get('/', (req, res) => {
  const query = `SELECT * FROM site_settings WHERE id = 1`;

  global.db.get(query, [], (err, row) => {
    if (err) {
      console.error("Error fetching site settings:", err.message);
      return res.status(500).send("Failed to load site settings.");
    }

    res.render('site-settings', {
      siteSettings: row,
      error: null
    });
  });
});

/*POST /
purpose: handle form submission to update the site name and description
input:
- req.body.siteName which is the new name of the site (string)
- req.body.description which is the new description of the site (string)
output: 
- if fields are missing the re-render form with error
- if update success then redirect to the organiser home page*/

router.post('/', (req, res) => {
  const { siteName, description } = req.body;

//validate form fields
  if (!siteName || !description) {
    return res.render('site-settings', {
      siteSettings: { site_name: siteName, description },
      error: "Please fill in all fields."
    });
  }

  const update = `UPDATE site_settings SET site_name = ?, description = ? WHERE id = 1`;

//run update query
  global.db.run(update, [siteName, description], function (err) {
    if (err) {
      console.error("Error updating site settings:", err.message);
      return res.status(500).send("Failed to update settings.");
    }

//redirect to organiser home after successful update
    res.redirect('/organiser');
  });
});

module.exports = router;