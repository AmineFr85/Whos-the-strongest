// backend/server.js
require('dotenv').config();
const express        = require('express');
const session        = require('express-session');
const cors           = require('cors');
const path           = require('path');

const authRoutes         = require('./routes/auth');
const competitionRoutes  = require('./routes/competitions');
const questionRoutes     = require('./routes/questions');
const gameRoutes         = require('./routes/games');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000, // 8h
  },
}));

// ── Static files ───────────────────────────────────────────
const PUBLIC = path.join(__dirname, '../frontend/public');
app.use(express.static(PUBLIC));

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/questions',    questionRoutes);
app.use('/api/games',        gameRoutes);

// ── SPA fallback ───────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

// ── Error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur.' });
});

app.listen(PORT, () => {
  console.log(`\n🏆  Who's the Stronger! — Server running`);
  console.log(`   http://localhost:${PORT}\n`);
});

module.exports = app;
