// frontend/public/js/app.js
const App = {
  init() {
    document.querySelectorAll('.modal-overlay').forEach(m =>
      m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); })
    );
  },
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'setup-screen')     Game.loadCompetitions();
    if (id === 'exam-entry-screen') Exam.loadEntry();
  },
  closeModal(id) { document.getElementById(id).classList.remove('open'); },
  notify(msg, isError = false) {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.className = 'notification' + (isError ? ' error' : '') + ' show';
    setTimeout(() => el.classList.remove('show'), 3500);
  },
  esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
  fmtDate(d) {
    return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  },
  setLoading(btnId, on) {
    const b = document.getElementById(btnId);
    if (!b) return;
    b.disabled = on;
    if (!b.dataset.orig) b.dataset.orig = b.textContent;
    b.textContent = on ? '⏳ ...' : b.dataset.orig;
  },
  renderQBody(elId, q) {
    const el = document.getElementById(elId);
    const labels = {qcm:'🔘 QCM',truefalse:'✅ Vrai/Faux',order:'🔢 Ordre',match:'🔗 Relier',fill:'✏️ Compléter',open:'📝 Libre'};
    let html = `<span class="q-type-badge badge-text">${labels[q.q_type]||'QCM'}</span>`;
    if (q.text) html += `<div class="question-text-el">${App.esc(q.text).replace(/\n/g,'&#10;')}</div>`;
    if (q.media_url) {
      const src = q.media_url;
      const isV = /video|\.mp4|\.webm/i.test(src);
      const isA = /audio|\.mp3|\.wav|\.m4a/i.test(src);
      html += '<div class="q-media-wrap">';
      if (isV)      html += `<video src="${src}" controls></video>`;
      else if (isA) html += `<audio src="${src}" controls></audio>`;
      else          html += `<img src="${src}" alt="">`;
      html += '</div>';
    }
    el.innerHTML = html;
  },
};
