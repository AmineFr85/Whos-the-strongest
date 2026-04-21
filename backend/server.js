// backend/server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  secret:            process.env.SESSION_SECRET || 'default_secret_change_me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge:   8 * 60 * 60 * 1000,
  },
}));

const PUBLIC = path.join(__dirname, '../frontend/public');
app.use(express.static(PUBLIC));

app.use('/api', require('./routes/index'));

app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur.' });
});

app.listen(PORT, () => {
  console.log(`\n🏆  Who's the Stronger! v2 — http://localhost:${PORT}\n`);
});

module.exports = app;
