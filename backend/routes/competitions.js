// backend/routes/competitions.js
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

// GET /api/competitions  (public)
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COUNT(q.id)::int AS question_count
      FROM competitions c
      LEFT JOIN questions q ON q.competition_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/competitions/:id  (public)
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM competitions WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Compétition introuvable.' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/competitions  (admin)
router.post('/', requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO competitions(name,description) VALUES($1,$2) RETURNING *',
      [name.trim(), description?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/competitions/:id  (admin)
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Le nom est requis.' });
  try {
    const { rows } = await pool.query(
      'UPDATE competitions SET name=$1, description=$2 WHERE id=$3 RETURNING *',
      [name.trim(), description?.trim() || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Compétition introuvable.' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/competitions/:id  (admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Detach questions
    await pool.query('UPDATE questions SET competition_id=NULL WHERE competition_id=$1', [req.params.id]);
    await pool.query('DELETE FROM competitions WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
