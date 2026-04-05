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
    if (id === 'setup-screen') Game.loadCompetitions();
  },

  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  notify(msg, isError = false) {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.className = 'notification' + (isError ? ' error' : '') + ' show';
    setTimeout(() => el.classList.remove('show'), 3200);
  },

  esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  fmtDate(d) {
    return new Date(d).toLocaleDateString('fr-FR', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    });
  },

  setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.dataset.orig = btn.dataset.orig || btn.textContent;
    btn.textContent = loading ? '⏳ ...' : btn.dataset.orig;
  },
};
