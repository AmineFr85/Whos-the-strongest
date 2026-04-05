// frontend/public/js/admin.js

// ── Admin auth ────────────────────────────────────────────
const Admin = {
  async login() {
    const pw = document.getElementById('admin-password').value;
    if (!pw) return App.notify('Entrez le mot de passe.', true);
    try {
      App.setLoading(null, true);
      await API.login(pw);
      document.getElementById('admin-password').value = '';
      App.showScreen('admin-screen');
      Admin.loadAll();
    } catch (e) {
      App.notify(e.message, true);
    }
  },

  async logout() {
    await API.logout().catch(() => {});
    App.showScreen('home-screen');
  },

  switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`atab-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    if (tab === 'history') Admin.loadHistory();
  },

  loadAll() {
    QAdmin.load();
    CAdmin.load();
  },
};

// ── Competitions table ────────────────────────────────────
const CAdmin = {
  async load() {
    try {
      const comps = await API.getCompetitions();
      const tbody = document.getElementById('c-tbody');
      const empty = document.getElementById('c-empty');
      tbody.innerHTML = '';
      if (!comps.length) { empty.style.display = 'block'; return; }
      empty.style.display = 'none';
      comps.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:700">${App.esc(c.name)}</td>
          <td style="opacity:.6;font-size:.9rem">${App.esc(c.description||'—')}</td>
          <td><span class="tag tag-blue">${c.question_count} question${c.question_count>1?'s':''}</span></td>
          <td style="opacity:.5;font-size:.85rem">${App.fmtDate(c.created_at)}</td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-xs" onclick="CModal.open(${c.id})">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="CAdmin.delete(${c.id})">🗑️</button>
          </td>`;
        tbody.appendChild(tr);
      });
    } catch (e) { App.notify('Erreur chargement compétitions.', true); }
  },

  async delete(id) {
    if (!confirm('Supprimer cette compétition ? Les questions seront détachées.')) return;
    try {
      await API.deleteCompetition(id);
      App.notify('Compétition supprimée !');
      CAdmin.load();
      QAdmin.load();
    } catch (e) { App.notify(e.message, true); }
  },
};

// ── Questions table ───────────────────────────────────────
const QAdmin = {
  async load() {
    try {
      const qs = await API.getQuestions();
      const tbody = document.getElementById('q-tbody');
      const empty = document.getElementById('q-empty');
      tbody.innerHTML = '';
      if (!qs.length) { empty.style.display = 'block'; return; }
      empty.style.display = 'none';

      const tl  = { text:'📝 Texte', image:'🖼️ Image', video:'🎬 Vidéo', audio:'🎵 Audio', mixed:'🔀 Mixte' };
      const tc  = { text:'tag-blue', image:'tag-purple', video:'tag-red', audio:'tag-green', mixed:'tag-orange' };

      qs.forEach(q => {
        const cAns = q.answers[q.correct_index];
        const isImg = q.media_url && !/\.(mp4|webm|mov|mp3|wav|m4a)/i.test(q.media_url);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${isImg ? `<img src="${q.media_url}" class="thumb-preview">` : (q.media_url ? '🎬' : '—')}</td>
          <td><span class="tag ${tc[q.q_type]||'tag-blue'}">${tl[q.q_type]||'Texte'}</span></td>
          <td style="max-width:220px">${App.esc((q.text||'').substring(0,70))}</td>
          <td><span class="tag ${tc[q.ans_type]||'tag-blue'}">${tl[q.ans_type]||'Texte'}</span></td>
          <td><span class="tag tag-green">${cAns.img?'🖼️ ':''} ${App.esc(cAns.text||'(image)')}</span></td>
          <td>${q.competition_name ? `<span class="tag tag-blue">${App.esc(q.competition_name)}</span>` : '<span style="opacity:.4">—</span>'}</td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-xs" onclick="QModal.open(${q.id})">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="QAdmin.delete(${q.id})">🗑️</button>
          </td>`;
        tbody.appendChild(tr);
      });
    } catch (e) { App.notify('Erreur chargement questions.', true); }
  },

  async delete(id) {
    if (!confirm('Supprimer cette question ?')) return;
    try {
      await API.deleteQuestion(id);
      App.notify('Question supprimée !');
      QAdmin.load();
    } catch (e) { App.notify(e.message, true); }
  },
};

// ── Competition modal ─────────────────────────────────────
const CModal = {
  async open(editId) {
    document.getElementById('c-edit-id').value = editId || '';
    document.getElementById('cmodal-title').textContent = editId ? 'Modifier la Compétition' : 'Créer une Compétition';
    document.getElementById('comp-name').value = '';
    document.getElementById('comp-desc').value = '';

    if (editId) {
      try {
        const c = await API.req('GET', `/api/competitions/${editId}`);
        document.getElementById('comp-name').value = c.name;
        document.getElementById('comp-desc').value = c.description || '';
      } catch (e) { App.notify(e.message, true); return; }
    }
    document.getElementById('competition-modal').classList.add('open');
  },

  async save() {
    const name = document.getElementById('comp-name').value.trim();
    const description = document.getElementById('comp-desc').value.trim();
    if (!name) return App.notify('Le nom est requis !', true);
    const editId = document.getElementById('c-edit-id').value;
    try {
      App.setLoading('c-save-btn', true);
      if (editId) await API.updateCompetition(editId, { name, description });
      else        await API.createCompetition({ name, description });
      App.closeModal('competition-modal');
      App.notify('Compétition enregistrée !');
      CAdmin.load();
    } catch (e) { App.notify(e.message, true); }
    finally { App.setLoading('c-save-btn', false); }
  },
};

// ── Question modal ────────────────────────────────────────
const QModal = {
  state: { qType: 'text', ansType: 'text', mediaFile: null, ansFiles: [null,null,null,null], correctIdx: 0 },

  async open(editId) {
    // Reset state
    this.state = { qType:'text', ansType:'text', mediaFile:null, ansFiles:[null,null,null,null], correctIdx:0 };

    // Populate competition dropdown
    try {
      const comps = await API.getCompetitions();
      const sel = document.getElementById('q-competition');
      sel.innerHTML = '<option value="">-- Aucune --</option>';
      comps.forEach(c => { const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; sel.appendChild(o); });
    } catch (_) {}

    document.getElementById('q-edit-id').value = '';
    document.getElementById('q-text').value = '';
    document.getElementById('q-media-url').value = '';
    document.getElementById('q-media-preview').innerHTML = '';
    document.getElementById('qmedia-group').style.display = 'none';
    document.getElementById('qtext-group').style.display = 'block';
    document.querySelectorAll('#qtype-pills .type-pill').forEach(b => b.classList.toggle('active', b.dataset.qtype==='text'));
    document.querySelectorAll('#atype-pills .type-pill').forEach(b => b.classList.toggle('active', b.dataset.atype==='text'));
    document.getElementById('qmodal-title').textContent = editId ? 'Modifier la Question' : 'Ajouter une Question';

    if (editId) {
      try {
        const q = await API.req('GET', `/api/questions/${editId}`);
        document.getElementById('q-edit-id').value = editId;
        document.getElementById('q-text').value = q.text || '';
        document.getElementById('q-competition').value = q.competition_id || '';
        this.state.qType = q.q_type || 'text';
        this.state.ansType = q.ans_type || 'text';
        this.state.correctIdx = q.correct_index ?? 0;

        document.querySelectorAll('#qtype-pills .type-pill').forEach(b => b.classList.toggle('active', b.dataset.qtype===this.state.qType));
        document.querySelectorAll('#atype-pills .type-pill').forEach(b => b.classList.toggle('active', b.dataset.atype===this.state.ansType));

        const hasMedia = ['image','video','audio','mixed'].includes(this.state.qType);
        document.getElementById('qmedia-group').style.display = hasMedia ? 'block' : 'none';
        document.getElementById('qtext-group').style.display = (this.state.qType==='image') ? 'none' : 'block';

        if (q.media_url) {
          if (!q.media_url.startsWith('/uploads/')) document.getElementById('q-media-url').value = q.media_url;
          this._showMediaPreview(q.media_url);
        }
        this._buildAnsGrid(q.answers);
      } catch (e) { App.notify(e.message, true); return; }
    } else {
      this._buildAnsGrid(null);
    }

    document.getElementById('question-modal').classList.add('open');
  },

  setQType(btn) {
    document.querySelectorAll('#qtype-pills .type-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.state.qType = btn.dataset.qtype;
    const hasMedia = ['image','video','audio','mixed'].includes(this.state.qType);
    document.getElementById('qmedia-group').style.display = hasMedia ? 'block' : 'none';
    document.getElementById('qtext-group').style.display = (this.state.qType==='image') ? 'none' : 'block';
    const icons = { image:'🖼️', video:'🎬', audio:'🎵', mixed:'🔀' };
    document.getElementById('q-drop-icon').textContent = icons[this.state.qType] || '📁';
    const accepts = { image:'image/*', video:'video/*', audio:'audio/*', mixed:'image/*,video/*,audio/*' };
    document.getElementById('q-media-file').accept = accepts[this.state.qType] || 'image/*,video/*,audio/*';
  },

  setAType(btn) {
    document.querySelectorAll('#atype-pills .type-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.state.ansType = btn.dataset.atype;
    this._buildAnsGrid(null);
  },

  onMediaFile(input) {
    const file = input.files[0];
    if (!file) return;
    this.state.mediaFile = file;
    document.getElementById('q-media-url').value = '';
    this._showMediaPreview(URL.createObjectURL(file));
  },

  onMediaUrl(url) {
    this.state.mediaFile = null;
    if (url) this._showMediaPreview(url);
    else document.getElementById('q-media-preview').innerHTML = '';
  },

  _showMediaPreview(src) {
    const p = document.getElementById('q-media-preview');
    if (!src) { p.innerHTML = ''; return; }
    const isV = /video|\.mp4|\.webm|\.mov/i.test(src);
    const isA = /audio|\.mp3|\.wav|\.m4a/i.test(src);
    if (isV)      p.innerHTML = `<video src="${src}" controls style="max-height:110px"></video>`;
    else if (isA) p.innerHTML = `<audio src="${src}" controls></audio>`;
    else          p.innerHTML = `<img src="${src}" style="max-height:110px;object-fit:contain;border-radius:8px">`;
  },

  _buildAnsGrid(existing) {
    const grid = document.getElementById('ans-grid');
    grid.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const ans = existing ? existing[i] : { text:'', img:'' };
      const isCorrect = i === this.state.correctIdx;
      const card = document.createElement('div');
      card.className = 'ans-card' + (isCorrect ? ' is-correct' : '');
      card.id = 'ans-card-' + i;

      let html = `<button class="ans-mark-btn" onclick="QModal.markCorrect(${i})">${isCorrect?'✅':'⬜'}</button>`;

      if (['image','mixed'].includes(this.state.ansType)) {
        const src = ans.img || '';
        if (src) html += `<img src="${src}" class="ans-img-prev" id="ans-img-prev-${i}">`;
        else     html += `<div id="ans-img-prev-${i}" style="width:100%;height:45px;border-radius:6px;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:.72rem;opacity:.5;margin-bottom:6px">📷 Image</div>`;
        html += `<label style="display:block;cursor:pointer;font-size:.7rem;opacity:.55;text-align:center;margin-bottom:5px">
          <input type="file" accept="image/*" style="display:none" onchange="QModal.onAnsImg(this,${i})">Uploader
        </label>
        <input type="text" class="form-input" id="ans-img-url-${i}" placeholder="ou URL image..." style="font-size:.78rem;padding:7px 10px;margin-bottom:5px" value="${ans.img&&ans.img.startsWith('http')?App.esc(ans.img):''}" oninput="QModal.onAnsImgUrl(this.value,${i})">`;
      }

      if (['text','mixed'].includes(this.state.ansType)) {
        html += `<input type="text" class="form-input" id="ans-text-${i}" placeholder="Réponse ${i+1}" style="font-size:.88rem;padding:9px 12px" value="${App.esc(ans.text||'')}">`;
      } else {
        html += `<input type="hidden" id="ans-text-${i}" value="${App.esc(ans.text||'')}">`;
      }

      card.innerHTML = html;
      grid.appendChild(card);
    }
  },

  markCorrect(idx) {
    this.state.correctIdx = idx;
    for (let i = 0; i < 4; i++) {
      const card = document.getElementById('ans-card-' + i);
      const btn  = card?.querySelector('.ans-mark-btn');
      if (card) card.classList.toggle('is-correct', i === idx);
      if (btn)  btn.textContent = i === idx ? '✅' : '⬜';
    }
  },

  onAnsImg(input, idx) {
    const file = input.files[0]; if (!file) return;
    this.state.ansFiles[idx] = file;
    const prev = document.getElementById('ans-img-prev-' + idx);
    const src  = URL.createObjectURL(file);
    if (prev?.tagName === 'IMG') { prev.src = src; }
    else { const img = document.createElement('img'); img.src = src; img.className = 'ans-img-prev'; img.id = 'ans-img-prev-' + idx; prev?.replaceWith(img); }
    document.getElementById('ans-img-url-' + idx).value = '';
  },

  onAnsImgUrl(url, idx) {
    this.state.ansFiles[idx] = null;
    const prev = document.getElementById('ans-img-prev-' + idx);
    if (prev?.tagName === 'IMG') prev.src = url;
  },

  async save() {
    const text    = document.getElementById('q-text').value.trim();
    const compId  = document.getElementById('q-competition').value;
    const editId  = document.getElementById('q-edit-id').value;
    const mediaUrl= document.getElementById('q-media-url').value.trim();

    // Build answers array
    const answers = [];
    for (let i = 0; i < 4; i++) {
      const t   = document.getElementById('ans-text-' + i)?.value.trim() || '';
      const url = document.getElementById('ans-img-url-' + i)?.value.trim() || '';
      answers.push({ text: t, img: url });
    }

    if (!text && !mediaUrl && !this.state.mediaFile)
      return App.notify('Ajoutez un texte ou un média !', true);
    if (answers.some(a => !a.text && !a.img && !this.state.ansFiles[answers.indexOf(a)]))
      return App.notify('Remplissez toutes les réponses !', true);

    // Build FormData
    const fd = new FormData();
    fd.append('q_type',        this.state.qType);
    fd.append('ans_type',      this.state.ansType);
    fd.append('text',          text);
    fd.append('media_url',     mediaUrl);
    fd.append('answers',       JSON.stringify(answers));
    fd.append('correct_index', this.state.correctIdx);
    fd.append('competition_id', compId || '');
    if (this.state.mediaFile) fd.append('media', this.state.mediaFile);
    for (let i = 0; i < 4; i++) {
      if (this.state.ansFiles[i]) fd.append(`ans_img_${i}`, this.state.ansFiles[i]);
    }

    try {
      App.setLoading('q-save-btn', true);
      await API.saveQuestion(fd, editId || null);
      App.closeModal('question-modal');
      App.notify('Question enregistrée !');
      QAdmin.load();
    } catch (e) { App.notify(e.message, true); }
    finally { App.setLoading('q-save-btn', false); }
  },
};

// ── History ───────────────────────────────────────────────
Admin.loadHistory = async function () {
  try {
    const games = await API.getHistory();
    const tbody = document.getElementById('h-tbody');
    const empty = document.getElementById('h-empty');
    tbody.innerHTML = '';
    if (!games.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    games.forEach(g => {
      const winner = g.score1 > g.score2 ? g.team1_name : g.score2 > g.score1 ? g.team2_name : 'Égalité';
      const winnerCls = g.score1 > g.score2 ? 'tag-red' : g.score2 > g.score1 ? 'tag-blue' : 'tag-orange';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="opacity:.6;font-size:.85rem">${App.fmtDate(g.played_at)}</td>
        <td>${g.competition_name ? `<span class="tag tag-blue">${App.esc(g.competition_name)}</span>` : '—'}</td>
        <td style="color:#f7a5ad;font-weight:700">${App.esc(g.team1_name)}</td>
        <td style="font-family:'Bangers',cursive;font-size:1.2rem;letter-spacing:2px">${g.score1} – ${g.score2}</td>
        <td style="color:#6bc5e8;font-weight:700">${App.esc(g.team2_name)}</td>
        <td><span class="tag ${winnerCls}">${App.esc(winner)}</span></td>`;
      tbody.appendChild(tr);
    });
  } catch (e) { App.notify('Erreur chargement historique.', true); }
};
