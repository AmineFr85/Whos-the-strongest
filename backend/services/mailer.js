// backend/services/mailer.js
const nodemailer = require('nodemailer');
const pool       = require('../db/pool');

async function getTransporter() {
  // Try DB config first, fallback to env vars
  const { rows } = await pool.query('SELECT * FROM email_config LIMIT 1');
  const cfg = rows[0];

  const host = cfg?.smtp_host || process.env.SMTP_HOST;
  const port = cfg?.smtp_port || parseInt(process.env.SMTP_PORT) || 587;
  const user = cfg?.smtp_user || process.env.SMTP_USER;
  const pass = cfg?.smtp_pass || process.env.SMTP_PASS;

  if (!host || !user || !pass) throw new Error('Configuration SMTP incomplète.');

  return nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

async function getProfEmail() {
  const { rows } = await pool.query('SELECT prof_email, smtp_from FROM email_config LIMIT 1');
  return {
    profEmail: rows[0]?.prof_email || process.env.PROF_EMAIL || '',
    fromEmail:  rows[0]?.smtp_from  || process.env.SMTP_FROM  || '',
  };
}

// ── Send exam report to prof ──────────────────────────────
async function sendExamReport(session, examName, questions) {
  const transporter = await getTransporter();
  const { profEmail, fromEmail } = await getProfEmail();
  if (!profEmail) throw new Error('Email du professeur non configuré.');

  const pct = session.percentage?.toFixed(1) || '0';
  const passed = session.passed ? '✅ Reçu' : '❌ Non reçu';

  // Build answers table rows
  let answersHtml = '';
  const answers = session.answers_json || [];
  answers.forEach((ans, i) => {
    const q = questions.find(q => q.id === ans.question_id);
    if (!q) return;
    const scoreColor = ans.score >= q.max_score ? '#2a9d8f' : ans.score > 0 ? '#f4a261' : '#e63946';
    answersHtml += `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:10px;font-weight:600">${i + 1}. ${escHtml(q.text || '')}</td>
        <td style="padding:10px">${escHtml(ans.given_answer || '—')}</td>
        <td style="padding:10px;color:${scoreColor};font-weight:700">${ans.score}/${q.max_score}</td>
        <td style="padding:10px;color:#666;font-style:italic">${escHtml(ans.feedback || '')}</td>
      </tr>`;
  });

  const html = `
    <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px">
    <div style="max-width:700px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)">
      <div style="background:linear-gradient(135deg,#1d3557,#457b9d);padding:30px;color:white;text-align:center">
        <h1 style="margin:0;font-size:1.8rem">📝 Compte-rendu d'examen</h1>
        <p style="margin:8px 0 0;opacity:.85">${escHtml(examName)}</p>
      </div>
      <div style="padding:24px">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr>
            <td style="padding:8px 0"><strong>👤 Élève :</strong></td>
            <td>${escHtml(session.student_name)}</td>
            <td style="padding:8px 0"><strong>🏫 Classe :</strong></td>
            <td>${escHtml(session.class_name || '—')}</td>
          </tr>
          <tr>
            <td style="padding:8px 0"><strong>📧 Email :</strong></td>
            <td>${escHtml(session.student_email || '—')}</td>
            <td style="padding:8px 0"><strong>📅 Date :</strong></td>
            <td>${new Date(session.started_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
          </tr>
        </table>
        <div style="background:linear-gradient(135deg,#f1faee,#a8dadc);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          <div style="font-size:3rem;font-weight:900;color:#1d3557">${pct}%</div>
          <div style="font-size:1.2rem;color:#457b9d">${session.score} / ${session.max_score} points</div>
          <div style="font-size:1rem;margin-top:8px">${passed}</div>
        </div>
        <h3 style="color:#1d3557;border-bottom:2px solid #a8dadc;padding-bottom:8px">Détail des réponses</h3>
        <table style="width:100%;border-collapse:collapse;font-size:.9rem">
          <thead>
            <tr style="background:#f1faee">
              <th style="padding:10px;text-align:left">Question</th>
              <th style="padding:10px;text-align:left">Réponse donnée</th>
              <th style="padding:10px;text-align:left">Score</th>
              <th style="padding:10px;text-align:left">Feedback</th>
            </tr>
          </thead>
          <tbody>${answersHtml}</tbody>
        </table>
      </div>
      <div style="background:#f1faee;padding:16px;text-align:center;color:#888;font-size:.8rem">
        Envoyé automatiquement par Who's the Stronger! Platform
      </div>
    </div>
    </body></html>`;

  await transporter.sendMail({
    from: `"Who's the Stronger!" <${fromEmail}>`,
    to: profEmail,
    subject: `📝 Examen "${examName}" — ${session.student_name} — ${pct}%`,
    html,
  });
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

module.exports = { sendExamReport, getTransporter, getProfEmail };
