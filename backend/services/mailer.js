// backend/services/mailer.js
// Uses Google Apps Script as email relay (no SMTP restrictions)
const pool = require('../db/pool');

async function getProfEmail() {
  const { rows } = await pool.query('SELECT prof_email FROM email_config LIMIT 1');
  return rows[0]?.prof_email || process.env.PROF_EMAIL || '';
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildHtml(session, examName, answers, questions) {
  const pct    = parseFloat(session.percentage || 0).toFixed(1);
  const passed = session.passed ? '✅ Réussi' : '❌ Non réussi';

  let answersHtml = '';
  answers.forEach((ans, i) => {
    const q = questions.find(q => String(q.id) === String(ans.question_id));
    if (!q) return;
    const scoreColor = ans.score >= q.max_score ? '#2a9d8f' : ans.score > 0 ? '#f4a261' : '#e63946';
    answersHtml += `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:10px;font-weight:600">${i+1}. ${escHtml(q.text||'')}</td>
        <td style="padding:10px">${escHtml(ans.given_answer||'—')}</td>
        <td style="padding:10px;color:${scoreColor};font-weight:700">${ans.score}/${q.max_score}</td>
        <td style="padding:10px;color:#666;font-style:italic">${escHtml(ans.feedback||'')}</td>
      </tr>`;
  });

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px">
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
            <td>${escHtml(session.class_name||'—')}</td>
          </tr>
          <tr>
            <td style="padding:8px 0"><strong>📧 Email :</strong></td>
            <td>${escHtml(session.student_email||'—')}</td>
            <td style="padding:8px 0"><strong>📅 Date :</strong></td>
            <td>${new Date(session.started_at).toLocaleDateString('fr-FR',{
              day:'2-digit',month:'2-digit',year:'numeric',
              hour:'2-digit',minute:'2-digit'
            })}</td>
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
}

async function sendViaRelay(to, subject, html) {
  const relayUrl = process.env.GMAIL_RELAY_URL;
  if (!relayUrl) throw new Error('GMAIL_RELAY_URL manquant dans les variables Railway.');

  const response = await fetch(relayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, html }),
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (data.error) throw new Error(data.error);
  return data;
}

async function sendExamReport(session, examName, questions) {
  const answers   = session.answers_json || [];
  const html      = buildHtml(session, examName, answers, questions);
  const pct       = parseFloat(session.percentage || 0).toFixed(1);
  const profEmail = await getProfEmail();

  const errors = [];

  // ── Send to professor ─────────────────────────────────
  if (profEmail) {
    try {
      await sendViaRelay(
        profEmail,
        `📝 Examen "${examName}" — ${session.student_name} — ${pct}%`,
        html
      );
      console.log(`📧 Email prof envoyé à ${profEmail}`);
    } catch(e) {
      errors.push(`Prof: ${e.message}`);
      console.error(`📧 Erreur email prof: ${e.message}`);
    }
  }

  // ── Send to student ───────────────────────────────────
  if (session.student_email) {
    try {
      await sendViaRelay(
        session.student_email,
        `📝 Vos résultats — ${examName} — ${pct}%`,
        html
      );
      console.log(`📧 Email élève envoyé à ${session.student_email}`);
    } catch(e) {
      errors.push(`Élève: ${e.message}`);
      console.error(`📧 Erreur email élève: ${e.message}`);
    }
  }

  if (errors.length) throw new Error(errors.join(' | '));
}

async function testConnection() {
  const relayUrl = process.env.GMAIL_RELAY_URL;
  if (!relayUrl) throw new Error('GMAIL_RELAY_URL manquant dans les variables Railway.');

  // Send a real test email to prof
  const profEmail = await getProfEmail();
  if (!profEmail) throw new Error('Email du professeur non configuré dans Admin → Email SMTP.');

  await sendViaRelay(
    profEmail,
    '✅ Test connexion — Who\'s the Stronger! Platform',
    `<div style="font-family:Arial,sans-serif;padding:30px;text-align:center">
      <h2 style="color:#2a9d8f">✅ Connexion email fonctionnelle !</h2>
      <p>Le relay Google Apps Script fonctionne correctement.</p>
      <p style="color:#888;font-size:.85rem">Who's the Stronger! Platform</p>
    </div>`
  );
}

async function getProfEmailConfig() {
  const { rows } = await pool.query('SELECT prof_email, smtp_from FROM email_config LIMIT 1');
  return { profEmail: rows[0]?.prof_email||'', fromEmail: rows[0]?.smtp_from||'' };
}

module.exports = { sendExamReport, testConnection, getProfEmail, getProfEmailConfig };
