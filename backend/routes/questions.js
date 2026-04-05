// backend/routes/questions.js
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');
const upload  = require('../middleware/upload');

// ── helpers ──────────────────────────────────────────────
function validateQuestion(body) {
  const { q_type, ans_type, answers, correct_index } = body;
  if (!['text','image','video','audio','mixed'].includes(q_type))
    return 'q_type invalide.';
  if (!['text','image','mixed'].includes(ans_type))
    return 'ans_type invalide.';
  let parsed;
  try { parsed = typeof answers === 'string' ? JSON.parse(answers) : answers; }
  catch { return 'Answers JSON invalide.'; }
  if (!Array.isArray(parsed) || parsed.length !== 4)
    return 'Il faut exactement 4 réponses.';
  if (parsed.some(a => !a.text?.trim() && !a.img?.trim()))
    return 'Chaque réponse doit avoir un texte ou une image.';
  const ci = parseInt(correct_index);
  if (isNaN(ci) || ci < 0 || ci > 3)
    return 'correct_index doit être entre 0 et 3.';
  return null;
}

function deleteFile(url) {
  if (!url) return;
  // Only delete local /uploads/ files
  if (!url.startsWith('/uploads/')) return;
  const filePath = path.join(__dirname, '../../frontend/public', url);
  if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
}

// ── GET /api/questions?competition_id=x  (public) ────────
router.get('/', async (req, res) => {
  try {
    let query = `
      SELECT q.*, c.name AS competition_name
      FROM questions q
      LEFT JOIN competitions c ON c.id = q.competition_id
    `;
    const params = [];
    if (req.query.competition_id) {
      query += ' WHERE q.competition_id = $1';
      params.push(req.query.competition_id);
    }
    query += ' ORDER BY q.created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/questions/:id  (public) ─────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM questions WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Question introuvable.' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/questions  (admin) ─────────────────────────
// Fields: q_type, text, ans_type, answers(JSON string), correct_index, competition_id
// Files:  media (optional), ans_img_0..3 (optional)
router.post('/', requireAdmin,
  upload.fields([
    { name: 'media',     maxCount: 1 },
    { name: 'ans_img_0', maxCount: 1 },
    { name: 'ans_img_1', maxCount: 1 },
    { name: 'ans_img_2', maxCount: 1 },
    { name: 'ans_img_3', maxCount: 1 },
  ]),
  async (req, res) => {
    const err = validateQuestion(req.body);
    if (err) return res.status(400).json({ error: err });

    try {
      // Build media_url
      let mediaUrl = req.body.media_url?.trim() || '';
      if (req.files?.media?.[0]) {
        mediaUrl = '/uploads/' + req.files.media[0].filename;
      }

      // Build answers with injected image paths
      let answers = typeof req.body.answers === 'string'
        ? JSON.parse(req.body.answers) : req.body.answers;

      for (let i = 0; i < 4; i++) {
        const fileKey = `ans_img_${i}`;
        if (req.files?.[fileKey]?.[0]) {
          answers[i].img = '/uploads/' + req.files[fileKey][0].filename;
        }
      }

      const { rows } = await pool.query(`
        INSERT INTO questions
          (competition_id, q_type, text, media_url, ans_type, answers, correct_index)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          req.body.competition_id || null,
          req.body.q_type,
          req.body.text?.trim() || null,
          mediaUrl || null,
          req.body.ans_type,
          JSON.stringify(answers),
          parseInt(req.body.correct_index),
        ]
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// ── PUT /api/questions/:id  (admin) ──────────────────────
router.put('/:id', requireAdmin,
  upload.fields([
    { name: 'media',     maxCount: 1 },
    { name: 'ans_img_0', maxCount: 1 },
    { name: 'ans_img_1', maxCount: 1 },
    { name: 'ans_img_2', maxCount: 1 },
    { name: 'ans_img_3', maxCount: 1 },
  ]),
  async (req, res) => {
    const err = validateQuestion(req.body);
    if (err) return res.status(400).json({ error: err });

    try {
      // Fetch existing
      const { rows: existing } = await pool.query('SELECT * FROM questions WHERE id=$1', [req.params.id]);
      if (!existing.length) return res.status(404).json({ error: 'Question introuvable.' });
      const old = existing[0];

      // media_url
      let mediaUrl = req.body.media_url?.trim() || old.media_url || '';
      if (req.files?.media?.[0]) {
        deleteFile(old.media_url);
        mediaUrl = '/uploads/' + req.files.media[0].filename;
      }

      // answers
      let answers = typeof req.body.answers === 'string'
        ? JSON.parse(req.body.answers) : req.body.answers;
      const oldAnswers = old.answers;

      for (let i = 0; i < 4; i++) {
        const fileKey = `ans_img_${i}`;
        if (req.files?.[fileKey]?.[0]) {
          deleteFile(oldAnswers[i]?.img);
          answers[i].img = '/uploads/' + req.files[fileKey][0].filename;
        }
      }

      const { rows } = await pool.query(`
        UPDATE questions SET
          competition_id=$1, q_type=$2, text=$3, media_url=$4,
          ans_type=$5, answers=$6, correct_index=$7
        WHERE id=$8 RETURNING *`,
        [
          req.body.competition_id || null,
          req.body.q_type,
          req.body.text?.trim() || null,
          mediaUrl || null,
          req.body.ans_type,
          JSON.stringify(answers),
          parseInt(req.body.correct_index),
          req.params.id,
        ]
      );
      res.json(rows[0]);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// ── DELETE /api/questions/:id  (admin) ───────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM questions WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Question introuvable.' });
    const q = rows[0];

    deleteFile(q.media_url);
    if (q.answers) q.answers.forEach(a => deleteFile(a.img));

    await pool.query('DELETE FROM questions WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/questions/upload-media  (admin) ─────────────
// Standalone media upload (returns URL)
router.post('/upload-media', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant.' });
  res.json({ url: '/uploads/' + req.file.filename });
});

module.exports = router;
