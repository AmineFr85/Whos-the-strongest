// backend/middleware/auth.js
require('dotenv').config();

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Non autorisé. Connexion admin requise.' });
}

module.exports = { requireAdmin };
