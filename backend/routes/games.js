// backend/routes/games.js
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

// POST /api/games/start  (public) ─ start a session, returns shuffled questions
router.post('/start', async (req, res) => {
  const { competition_id, team1_name, team2_name, max_questions = 8 } = req.body;
  if (!competition_id) return res.status(400).json({ error: 'competition_id requis.' });
  if (!team1_name?.trim() || !team2_name?.trim())
    return res.status(400).json({ error: 'Les noms des deux équipes sont requis.' });

  try {
    // Fetch & shuffle questions
    const { rows: questions } = await pool.query(
      'SELECT * FROM questions WHERE competition_id=$1 ORDER BY RANDOM() LIMIT $2',
      [competition_id, Math.min(parseInt(max_questions) || 8, 20)]
    );
    if (questions.length < 2)
      return res.status(400).json({ error: 'La compétition doit avoir au moins 2 questions.' });

    // Create session
    const { rows: [session] } = await pool.query(
      `INSERT INTO game_sessions(competition_id,team1_name,team2_name)
       VALUES($1,$2,$3) RETURNING *`,
      [competition_id, team1_name.trim(), team2_name.trim()]
    );

    // Strip correct_index from client response (sent only at reveal)
    const safeQuestions = questions.map(q => ({
      id: q.id, q_type: q.q_type, text: q.text,
      media_url: q.media_url, ans_type: q.ans_type,
      answers: q.answers, // {text, img} – no correct hint
    }));

    res.json({ session, questions: safeQuestions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/games/:sessionId/answer  (public) ─ check answer, return correct_index
router.post('/:sessionId/answer', async (req, res) => {
  const { question_id, team, choice_index } = req.body;
  if (!question_id || team === undefined || choice_index === undefined)
    return res.status(400).json({ error: 'question_id, team, choice_index requis.' });

  try {
    const { rows } = await pool.query(
      'SELECT correct_index FROM questions WHERE id=$1', [question_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Question introuvable.' });

    const correct = rows[0].correct_index;
    const isCorrect = parseInt(choice_index) === correct;

    res.json({ correct_index: correct, is_correct: isCorrect });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/games/:sessionId/finish  (public) ─ save final scores
router.post('/:sessionId/finish', async (req, res) => {
  const { score1, score2 } = req.body;
  try {
    await pool.query(
      `UPDATE game_sessions SET score1=$1, score2=$2, status='finished' WHERE id=$3`,
      [score1 ?? 0, score2 ?? 0, req.params.sessionId]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/games  (admin) ─ history
router.get('/', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT g.*, c.name AS competition_name
      FROM game_sessions g
      LEFT JOIN competitions c ON c.id = g.competition_id
      ORDER BY g.played_at DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
