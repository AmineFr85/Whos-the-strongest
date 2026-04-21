// backend/routes/index.js  — all routes registered here
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const pool     = require('../db/pool');
const upload   = require('../middleware/upload');
const { requireAdmin } = require('../middleware/auth');
const { sendExamReport, getTransporter } = require('../services/mailer');

const router = express.Router();

// ═══════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════
router.post('/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Mot de passe incorrect.' });
});
router.post('/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
router.get('/auth/me', (req, res) => res.json({ isAdmin: !!(req.session?.isAdmin) }));

// ═══════════════════════════════════════════════════════
//  COMPETITIONS
// ═══════════════════════════════════════════════════════
router.get('/competitions', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COUNT(q.id)::int AS question_count
      FROM competitions c LEFT JOIN questions q ON q.competition_id=c.id
      GROUP BY c.id ORDER BY c.created_at DESC`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/competitions/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM competitions WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Introuvable.' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/competitions', requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO competitions(name,description) VALUES($1,$2) RETURNING *',
      [name.trim(), description?.trim()||null]);
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/competitions/:id', requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis.' });
  try {
    const { rows } = await pool.query(
      'UPDATE competitions SET name=$1,description=$2 WHERE id=$3 RETURNING *',
      [name.trim(), description?.trim()||null, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Introuvable.' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/competitions/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE questions SET competition_id=NULL WHERE competition_id=$1',[req.params.id]);
    await pool.query('DELETE FROM competitions WHERE id=$1',[req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
//  CLASSES
// ═══════════════════════════════════════════════════════
router.get('/classes', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM classes ORDER BY name');
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/classes', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis.' });
  try {
    const { rows } = await pool.query('INSERT INTO classes(name) VALUES($1) RETURNING *',[name.trim()]);
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/classes/:id', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis.' });
  try {
    const { rows } = await pool.query('UPDATE classes SET name=$1 WHERE id=$2 RETURNING *',[name.trim(),req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Introuvable.' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/classes/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM classes WHERE id=$1',[req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
//  QUESTIONS
// ═══════════════════════════════════════════════════════
router.get('/questions', async (req, res) => {
  try {
    let q = `SELECT qu.*,c.name AS competition_name FROM questions qu
             LEFT JOIN competitions c ON c.id=qu.competition_id`;
    const params = [];
    if (req.query.competition_id) { q += ' WHERE qu.competition_id=$1'; params.push(req.query.competition_id); }
    q += ' ORDER BY qu.created_at DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/questions/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM questions WHERE id=$1',[req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Introuvable.' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

const qUploadFields = upload.fields([
  { name:'media',maxCount:1 },
  ...Array.from({length:8},(_,i)=>({ name:`ans_img_${i}`,maxCount:1 }))
]);

function parseAndSaveQuestion(body, files, existingMediaUrl) {
  let mediaUrl = body.media_url?.trim() || existingMediaUrl || '';
  if (files?.media?.[0]) mediaUrl = '/uploads/' + files.media[0].filename;

  let answers;
  try { answers = typeof body.answers==='string' ? JSON.parse(body.answers) : body.answers; }
  catch { answers = []; }

  // Inject uploaded answer images
  if (Array.isArray(answers)) {
    answers.forEach((ans, i) => {
      if (files?.[`ans_img_${i}`]?.[0]) {
        ans.img = '/uploads/' + files[`ans_img_${i}`][0].filename;
      }
    });
  }

  return {
    q_type:          body.q_type || 'qcm',
    text:            body.text?.trim() || null,
    media_url:       mediaUrl || null,
    ans_type:        body.ans_type || 'text',
    answers:         JSON.stringify(answers),
    correct_index:   parseInt(body.correct_index) || 0,
    max_score:       parseFloat(body.max_score) || 1,
    partial_scoring: body.partial_scoring === 'true',
    feedback:        body.feedback?.trim() || null,
    competition_id:  body.competition_id || null,
  };
}

router.post('/questions', requireAdmin, qUploadFields, async (req, res) => {
  try {
    const d = parseAndSaveQuestion(req.body, req.files, null);
    const { rows } = await pool.query(`
      INSERT INTO questions(competition_id,q_type,text,media_url,ans_type,answers,correct_index,max_score,partial_scoring,feedback)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [d.competition_id,d.q_type,d.text,d.media_url,d.ans_type,d.answers,d.correct_index,d.max_score,d.partial_scoring,d.feedback]);
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/questions/:id', requireAdmin, qUploadFields, async (req, res) => {
  try {
    const { rows: old } = await pool.query('SELECT * FROM questions WHERE id=$1',[req.params.id]);
    if (!old.length) return res.status(404).json({ error: 'Introuvable.' });
    const d = parseAndSaveQuestion(req.body, req.files, old[0].media_url);
    const { rows } = await pool.query(`
      UPDATE questions SET competition_id=$1,q_type=$2,text=$3,media_url=$4,
        ans_type=$5,answers=$6,correct_index=$7,max_score=$8,partial_scoring=$9,feedback=$10
      WHERE id=$11 RETURNING *`,
      [d.competition_id,d.q_type,d.text,d.media_url,d.ans_type,d.answers,d.correct_index,d.max_score,d.partial_scoring,d.feedback,req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/questions/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM questions WHERE id=$1',[req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Introuvable.' });
    // Delete local files
    const q = rows[0];
    const del = (url) => {
      if (!url || !url.startsWith('/uploads/')) return;
      const fp = path.join(__dirname,'../../frontend/public',url);
      if (fs.existsSync(fp)) fs.unlink(fp,()=>{});
    };
    del(q.media_url);
    if (Array.isArray(q.answers)) q.answers.forEach(a => del(a.img));
    await pool.query('DELETE FROM questions WHERE id=$1',[req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
//  GAME (Who's the Stronger)
// ═══════════════════════════════════════════════════════
router.post('/games/start', async (req, res) => {
  const { competition_id, team1_name, team2_name, max_questions=8 } = req.body;
  if (!competition_id || !team1_name?.trim() || !team2_name?.trim())
    return res.status(400).json({ error: 'Paramètres manquants.' });
  try {
    const { rows: questions } = await pool.query(
      'SELECT * FROM questions WHERE competition_id=$1 ORDER BY RANDOM() LIMIT $2',
      [competition_id, Math.min(parseInt(max_questions)||8, 20)]);
    if (questions.length < 2) return res.status(400).json({ error: 'Pas assez de questions.' });
    const { rows:[session] } = await pool.query(
      'INSERT INTO game_sessions(competition_id,team1_name,team2_name) VALUES($1,$2,$3) RETURNING *',
      [competition_id, team1_name.trim(), team2_name.trim()]);
    // Strip correct info
    const safe = questions.map(q => ({
      id:q.id, q_type:q.q_type, text:q.text, media_url:q.media_url,
      ans_type:q.ans_type, answers:q.answers, max_score:q.max_score
    }));
    res.json({ session, questions: safe });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/games/:sid/answer', async (req, res) => {
  const { question_id, choice_index } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM questions WHERE id=$1',[question_id]);
    if (!rows.length) return res.status(404).json({ error: 'Question introuvable.' });
    const q = rows[0];
    res.json({ correct_index: q.correct_index, answers: q.answers });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/games/:sid/finish', async (req, res) => {
  const { score1, score2 } = req.body;
  try {
    await pool.query(
      `UPDATE game_sessions SET score1=$1,score2=$2,status='finished' WHERE id=$3`,
      [score1||0, score2||0, req.params.sid]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/games', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT g.*,c.name AS competition_name FROM game_sessions g
      LEFT JOIN competitions c ON c.id=g.competition_id
      ORDER BY g.played_at DESC LIMIT 100`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
//  EXAM CONFIGS
// ═══════════════════════════════════════════════════════
router.get('/exam-configs', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.*,c.name AS competition_name FROM exam_configs e
      LEFT JOIN competitions c ON c.id=e.competition_id
      ORDER BY e.created_at DESC`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/exam-configs/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.*,c.name AS competition_name FROM exam_configs e
      LEFT JOIN competitions c ON c.id=e.competition_id WHERE e.id=$1`,[req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Introuvable.' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/exam-configs', requireAdmin, async (req, res) => {
  const d = req.body;
  if (!d.name?.trim()) return res.status(400).json({ error: 'Nom requis.' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO exam_configs(competition_id,name,duration_minutes,shuffle_questions,shuffle_answers,
        allow_retry,allow_skip,show_feedback,show_score,max_attempts,pass_score)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [d.competition_id||null, d.name.trim(), parseInt(d.duration_minutes)||30,
       d.shuffle_questions==='true'||d.shuffle_questions===true,
       d.shuffle_answers==='true'||d.shuffle_answers===true,
       d.allow_retry==='true'||d.allow_retry===true,
       d.allow_skip==='true'||d.allow_skip===true,
       d.show_feedback!=='false', d.show_score!=='false',
       parseInt(d.max_attempts)||1, parseFloat(d.pass_score)||50]);
    res.status(201).json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/exam-configs/:id', requireAdmin, async (req, res) => {
  const d = req.body;
  if (!d.name?.trim()) return res.status(400).json({ error: 'Nom requis.' });
  try {
    const { rows } = await pool.query(`
      UPDATE exam_configs SET competition_id=$1,name=$2,duration_minutes=$3,shuffle_questions=$4,
        shuffle_answers=$5,allow_retry=$6,allow_skip=$7,show_feedback=$8,show_score=$9,
        max_attempts=$10,pass_score=$11 WHERE id=$12 RETURNING *`,
      [d.competition_id||null, d.name.trim(), parseInt(d.duration_minutes)||30,
       d.shuffle_questions==='true'||d.shuffle_questions===true,
       d.shuffle_answers==='true'||d.shuffle_answers===true,
       d.allow_retry==='true'||d.allow_retry===true,
       d.allow_skip==='true'||d.allow_skip===true,
       d.show_feedback!=='false', d.show_score!=='false',
       parseInt(d.max_attempts)||1, parseFloat(d.pass_score)||50,
       req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Introuvable.' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/exam-configs/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM exam_configs WHERE id=$1',[req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
//  EXAM SESSIONS (student taking exam)
// ═══════════════════════════════════════════════════════
router.post('/exams/start', async (req, res) => {
  const { exam_config_id, student_name, student_email, class_id } = req.body;
  if (!exam_config_id || !student_name?.trim())
    return res.status(400).json({ error: 'Paramètres manquants.' });
  try {
    const { rows:[cfg] } = await pool.query('SELECT * FROM exam_configs WHERE id=$1',[exam_config_id]);
    if (!cfg) return res.status(404).json({ error: 'Examen introuvable.' });

    // Check retry policy
    if (!cfg.allow_retry) {
      const { rows:prev } = await pool.query(
        `SELECT id FROM exam_sessions WHERE exam_config_id=$1 AND student_email=$2 AND finished_at IS NOT NULL LIMIT 1`,
        [exam_config_id, student_email||'']);
      if (prev.length) return res.status(403).json({ error: 'Vous avez déjà passé cet examen.' });
    }

    // Fetch & optionally shuffle questions
    let { rows: questions } = await pool.query(
      'SELECT * FROM questions WHERE competition_id=$1', [cfg.competition_id]);
    if (cfg.shuffle_questions) questions = questions.sort(()=>Math.random()-.5);

    // Optionally shuffle answers per question
    if (cfg.shuffle_answers) {
      questions = questions.map(q => {
        if (!['qcm','truefalse'].includes(q.q_type)) return q;
        const shuffled = [...q.answers].sort(()=>Math.random()-.5);
        return {...q, answers: shuffled};
      });
    }

    // Create session
    const { rows:[session] } = await pool.query(`
      INSERT INTO exam_sessions(exam_config_id,student_name,student_email,class_id,max_score)
      VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [exam_config_id, student_name.trim(), student_email?.trim()||null,
       class_id||null, questions.reduce((s,q)=>s+parseFloat(q.max_score||1),0)]);

    // Strip correct_index & feedback from client payload
    const safe = questions.map(q => ({
      id:q.id, q_type:q.q_type, text:q.text, media_url:q.media_url,
      ans_type:q.ans_type, max_score:q.max_score, partial_scoring:q.partial_scoring,
      answers: q.answers.map(a => {
        const {is_correct, score, ...rest} = a;
        return rest;
      }),
    }));

    res.json({ session, questions: safe, config: cfg });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/exams/:sid/submit', async (req, res) => {
  const { answers } = req.body; // [{question_id, given_answer, answer_indices}]
  try {
    const { rows:[session] } = await pool.query('SELECT * FROM exam_sessions WHERE id=$1',[req.params.sid]);
    if (!session) return res.status(404).json({ error: 'Session introuvable.' });

    const { rows:[cfg] } = await pool.query('SELECT * FROM exam_configs WHERE id=$1',[session.exam_config_id]);

    let totalScore = 0;
    const scoredAnswers = [];

    for (const ans of answers) {
      const { rows:[q] } = await pool.query('SELECT * FROM questions WHERE id=$1',[ans.question_id]);
      if (!q) continue;

      let earnedScore = 0;
      let givenAnswer = ans.given_answer || '';
      let feedback = '';

      switch(q.q_type) {
        case 'qcm':
        case 'truefalse': {
          const idx = parseInt(ans.answer_index ?? -1);
          const chosen = q.answers[idx];
          if (chosen) {
            earnedScore = q.partial_scoring ? parseFloat(chosen.score||0) : (chosen.is_correct ? parseFloat(q.max_score) : 0);
            feedback = chosen.feedback || '';
            givenAnswer = chosen.text || '';
          }
          break;
        }
        case 'order': {
          // ans.order_indices = [idx0, idx1, ...]
          const submitted = ans.order_indices || [];
          const correct = [...q.answers].sort((a,b)=>a.position-b.position).map((_,i)=>i);
          const correctOrder = q.answers.map(a=>a.position);
          let correctCount = 0;
          submitted.forEach((pos, i) => { if (q.answers[pos]?.position === i) correctCount++; });
          earnedScore = q.partial_scoring
            ? parseFloat(q.max_score) * correctCount / q.answers.length
            : (correctCount === q.answers.length ? parseFloat(q.max_score) : 0);
          givenAnswer = submitted.map(i=>q.answers[i]?.text||'').join(' → ');
          feedback = q.feedback || '';
          break;
        }
        case 'match': {
          // ans.match_pairs = [{left_idx, right_idx}]
          const pairs = ans.match_pairs || [];
          let correct = 0;
          pairs.forEach(p => { if (p.left_idx === p.right_idx) correct++; });
          earnedScore = q.partial_scoring
            ? parseFloat(q.max_score) * correct / q.answers.length
            : (correct === q.answers.length ? parseFloat(q.max_score) : 0);
          givenAnswer = pairs.map(p=>`${q.answers[p.left_idx]?.left_text}↔${q.answers[p.right_idx]?.right_text}`).join(', ');
          feedback = q.feedback || '';
          break;
        }
        case 'fill': {
          const blanks = q.answers[0]?.blanks || [];
          const given  = ans.fill_answers || [];
          let correct = 0;
          blanks.forEach((b,i) => {
            if ((given[i]||'').trim().toLowerCase() === b.word.toLowerCase()) correct++;
          });
          earnedScore = q.partial_scoring
            ? parseFloat(q.max_score) * correct / Math.max(blanks.length,1)
            : (correct === blanks.length ? parseFloat(q.max_score) : 0);
          givenAnswer = given.join(', ');
          feedback = q.feedback || '';
          break;
        }
        case 'open': {
          // Open questions: not auto-scored, marked for manual review
          earnedScore = 0;
          givenAnswer = ans.given_answer || '';
          feedback = 'Réponse libre — à corriger manuellement';
          break;
        }
      }

      totalScore += earnedScore;
      scoredAnswers.push({
        question_id: q.id,
        question_text: q.text,
        given_answer: givenAnswer,
        score: Math.round(earnedScore * 100) / 100,
        max_score: q.max_score,
        feedback: cfg.show_feedback ? feedback : '',
      });
    }

    const maxScore = parseFloat(session.max_score) || 1;
    const percentage = Math.round(totalScore / maxScore * 100 * 10) / 10;
    const passed = percentage >= parseFloat(cfg.pass_score||50);

    // Update session
    await pool.query(`
      UPDATE exam_sessions SET score=$1,percentage=$2,passed=$3,finished_at=NOW(),answers_json=$4 WHERE id=$5`,
      [Math.round(totalScore*100)/100, percentage, passed, JSON.stringify(scoredAnswers), req.params.sid]);

    // Send email to prof (async, don't block response)
    try {
      const { rows:[updatedSession] } = await pool.query(`
        SELECT es.*, cl.name AS class_name FROM exam_sessions es
        LEFT JOIN classes cl ON cl.id=es.class_id WHERE es.id=$1`,[req.params.sid]);
      updatedSession.answers_json = scoredAnswers;
      const { rows: allQ } = await pool.query('SELECT id,text,max_score FROM questions WHERE id=ANY($1)',
        [scoredAnswers.map(a=>a.question_id)]);
      const { rows:[examCfg] } = await pool.query('SELECT name FROM exam_configs WHERE id=$1',[session.exam_config_id]);
      sendExamReport(updatedSession, examCfg?.name||'Examen', allQ).catch(()=>{});
    } catch(_) {}

    res.json({
      score: Math.round(totalScore*100)/100,
      max_score: maxScore,
      percentage,
      passed,
      pass_score: cfg.pass_score,
      show_feedback: cfg.show_feedback,
      answers: scoredAnswers,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/exams', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT es.*, ec.name AS exam_name, cl.name AS class_name
      FROM exam_sessions es
      LEFT JOIN exam_configs ec ON ec.id=es.exam_config_id
      LEFT JOIN classes cl ON cl.id=es.class_id
      WHERE es.finished_at IS NOT NULL
      ORDER BY es.started_at DESC LIMIT 200`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/exams/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT es.*, ec.name AS exam_name, cl.name AS class_name
      FROM exam_sessions es
      LEFT JOIN exam_configs ec ON ec.id=es.exam_config_id
      LEFT JOIN classes cl ON cl.id=es.class_id
      WHERE es.id=$1`,[req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Introuvable.' });
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════
//  EMAIL CONFIG
// ═══════════════════════════════════════════════════════
router.get('/email-config', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id,smtp_host,smtp_port,smtp_user,smtp_from,prof_email FROM email_config LIMIT 1');
    res.json(rows[0] || {});
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/email-config', requireAdmin, async (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, prof_email } = req.body;
  try {
    const { rows: existing } = await pool.query('SELECT id FROM email_config LIMIT 1');
    if (existing.length) {
      const updates = [smtp_host, parseInt(smtp_port)||587, smtp_user, smtp_from, prof_email];
      let q = 'UPDATE email_config SET smtp_host=$1,smtp_port=$2,smtp_user=$3,smtp_from=$4,prof_email=$5,updated_at=NOW()';
      if (smtp_pass) { q += ',smtp_pass=$6'; updates.push(smtp_pass); }
      q += ` WHERE id=${existing[0].id} RETURNING id`;
      const { rows } = await pool.query(q, updates);
      res.json(rows[0]);
    } else {
      const { rows } = await pool.query(
        'INSERT INTO email_config(smtp_host,smtp_port,smtp_user,smtp_pass,smtp_from,prof_email) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
        [smtp_host,parseInt(smtp_port)||587,smtp_user,smtp_pass||'',smtp_from,prof_email]);
      res.json(rows[0]);
    }
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/email-config/test', requireAdmin, async (_req, res) => {
  try {
    const transporter = await getTransporter();
    await transporter.verify();
    res.json({ success: true, message: 'Connexion SMTP vérifiée ✅' });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
