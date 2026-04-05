// backend/routes/auth.js
const express = require('express');
require('dotenv').config();
const router  = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Mot de passe requis.' });

  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true, message: 'Connecté en tant qu\'admin.' });
  }
  return res.status(401).json({ error: 'Mot de passe incorrect.' });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

module.exports = router;
