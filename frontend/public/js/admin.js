// frontend/public/js/admin.js

// ── Admin Auth ────────────────────────────────────────────
const Admin = {
  async login() {
    const pw = document.getElementById('admin-password').value;
    if (!pw) return App.notify('Entrez le mot de passe.', true);
    try {
      await API.login(pw);
      document.getElementById('admin-password').value = '';
      App.showScreen('admin-screen');
      Admin.loadAll();
    } catch(e) { App.notify(e.message, true); }
  },
  async logout() { await API.logout().catch(()=>{}); App.showScreen('home-screen'); },
  switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById(`atab-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    if (tab==='results')  Admin.loadResults();
    if (tab==='history')  Admin.loadHistory();
    if (tab==='email')    Admin.loadEmailConfig();
  },
  loadAll() {
    QAdmin.load(); CAdmin.load(); ClassAdmin.load(); ECAdmin.load();
  },

  // ── Email config ──────────────────────────────────────
  async loadEmailConfig() {
    try {
      const cfg = await API.getEmailConfig();
      document.getElementById('smtp-host').value  = cfg.smtp_host||'';
      document.getElementById('smtp-port').value  = cfg.smtp_port||587;
      document.getElementById('smtp-user').value  = cfg.smtp_user||'';
      document.getElementById('smtp-from').value  = cfg.smtp_from||'';
      document.getElementById('prof-email').value = cfg.prof_email||'';
    } catch(_) {}
  },
  async saveEmailConfig() {
    const d = {
      smtp_host: document.getElementById('smtp-host').value.trim(),
      smtp_port: parseInt(document.getElementById('smtp-port').value)||587,
      smtp_user: document.getElementById('smtp-user').value.trim(),
      smtp_pass: document.getElementById('smtp-pass').value,
      smtp_from: document.getElementById('smtp-from').value.trim(),
      prof_email: document.getElementById('prof-email').value.trim(),
    };
    try { await API.saveEmailConfig(d); App.notify('Configuration email enregistrée !'); }
    catch(e) { App.notify(e.message, true); }
  },
  async testEmail() {
    try {
      const r = await API.testEmail();
      App.notify(r.message || 'Connexion OK !');
    } catch(e) { App.notify('Erreur : ' + e.message, true); }
  },

  // ── Results ───────────────────────────────────────────
  async loadResults() {
    try {
      const res = await API.getExamResults();
      const tbody=document.getElementById('res-tbody'), empty=document.getElementById('res-empty');
      tbody.innerHTML='';
      if (!res.length) { empty.style.display='block'; return; } empty.style.display='none';
      res.forEach(r => {
        const passed = r.passed;
        const tr=document.createElement('tr');
        tr.innerHTML=`
          <td style="font-size:.82rem;opacity:.6">${App.fmtDate(r.started_at)}</td>
          <td><span class="tag tag-blue">${App.esc(r.exam_name||'—')}</span></td>
          <td style="font-weight:700">${App.esc(r.student_name)}</td>
          <td><span class="tag tag-purple">${App.esc(r.class_name||'—')}</span></td>
          <td>${r.score}/${r.max_score}</td>
          <td style="font-weight:700">${r.percentage}%</td>
          <td><span class="tag ${passed?'tag-green':'tag-red'}">${passed?'✅ Réussi':'❌ Échoué'}</span></td>
          <td><button class="btn btn-ghost btn-xs" onclick="Admin.showExamDetail(${r.id})">👁️</button></td>`;
        tbody.appendChild(tr);
      });
    } catch(e) { App.notify('Erreur chargement résultats.', true); }
  },

  async showExamDetail(id) {
    try {
      const r = await API.getExamResult(id);
      const answers = r.answers_json || [];
      let html = `<div style="margin-bottom:16px">
        <strong>👤 ${App.esc(r.student_name)}</strong> — ${App.esc(r.class_name||'—')}<br>
        📝 ${App.esc(r.exam_name||'—')}<br>
        📊 Score : <strong>${r.score}/${r.max_score} (${r.percentage}%)</strong><br>
        ${r.passed ? '<span class="tag tag-green">✅ Réussi</span>' : '<span class="tag tag-red">❌ Échoué</span>'}
      </div>`;
      answers.forEach((a,i) => {
        const pct = a.max_score>0 ? a.score/a.max_score : 0;
        const cls = pct>=1?'correct':pct>0?'partial':'wrong';
        const colors = {correct:'var(--green)',partial:'var(--gold)',wrong:'var(--red)'};
        html += `<div class="exam-review-item ${cls}" style="margin-bottom:8px">
          <div class="exam-review-q">${i+1}. ${App.esc(a.question_text||'')}</div>
          <div class="exam-review-ans">Réponse : ${App.esc(a.given_answer||'—')}</div>
          <div style="color:${colors[cls]};font-weight:700;font-size:.85rem">${a.score}/${a.max_score} pt</div>
          ${a.feedback?`<div class="exam-review-feedback">${App.esc(a.feedback)}</div>`:''}
        </div>`;
      });
      document.getElementById('exam-detail-content').innerHTML = html;
      document.getElementById('exam-detail-modal').classList.add('open');
    } catch(e) { App.notify(e.message, true); }
  },

  // ── History ───────────────────────────────────────────
  async loadHistory() {
    try {
      const games=await API.getGames();
      const tbody=document.getElementById('h-tbody'), empty=document.getElementById('h-empty');
      tbody.innerHTML='';
      if (!games.length) { empty.style.display='block'; return; } empty.style.display='none';
      games.forEach(g => {
        const winner = g.score1>g.score2?g.team1_name:g.score2>g.score1?g.team2_name:'Égalité';
        const cls    = g.score1>g.score2?'tag-red':g.score2>g.score1?'tag-blue':'tag-orange';
        const tr=document.createElement('tr');
        tr.innerHTML=`<td style="opacity:.6;font-size:.82rem">${App.fmtDate(g.played_at)}</td>
          <td>${g.competition_name?`<span class="tag tag-blue">${App.esc(g.competition_name)}</span>`:'—'}</td>
          <td style="color:#f7a5ad;font-weight:700">${App.esc(g.team1_name)}</td>
          <td style="font-family:'Bangers',cursive;font-size:1.1rem;letter-spacing:2px">${g.score1}–${g.score2}</td>
          <td style="color:#6bc5e8;font-weight:700">${App.esc(g.team2_name)}</td>
          <td><span class="tag ${cls}">${App.esc(winner)}</span></td>`;
        tbody.appendChild(tr);
      });
    } catch(e) { App.notify('Erreur historique.', true); }
  },
};

// ── Competitions ──────────────────────────────────────────
const CAdmin = {
  async load() {
    try {
      const comps=await API.getCompetitions();
      const tbody=document.getElementById('c-tbody'), empty=document.getElementById('c-empty');
      tbody.innerHTML='';
      if (!comps.length) { empty.style.display='block'; return; } empty.style.display='none';
      comps.forEach(c => {
        const tr=document.createElement('tr');
        tr.innerHTML=`<td style="font-weight:700">${App.esc(c.name)}</td>
          <td style="opacity:.6;font-size:.88rem">${App.esc(c.description||'—')}</td>
          <td><span class="tag tag-blue">${c.question_count} q</span></td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-xs" onclick="CModal.open(${c.id})">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="CAdmin.delete(${c.id})">🗑️</button>
          </td>`;
        tbody.appendChild(tr);
      });
    } catch(e) {}
  },
  async delete(id) {
    if (!confirm('Supprimer ?')) return;
    try { await API.deleteCompetition(id); App.notify('Supprimé !'); CAdmin.load(); QAdmin.load(); }
    catch(e) { App.notify(e.message, true); }
  },
};

const CModal = {
  async open(editId) {
    document.getElementById('c-edit-id').value = editId||'';
    document.getElementById('cmodal-title').textContent = editId ? 'Modifier' : 'Créer une Compétition';
    document.getElementById('comp-name').value = '';
    document.getElementById('comp-desc').value = '';
    if (editId) {
      const c = await API.getCompetition(editId).catch(()=>null);
      if (c) { document.getElementById('comp-name').value=c.name; document.getElementById('comp-desc').value=c.description||''; }
    }
    document.getElementById('competition-modal').classList.add('open');
  },
  async save() {
    const name=document.getElementById('comp-name').value.trim(), desc=document.getElementById('comp-desc').value.trim();
    if (!name) return App.notify('Nom requis !', true);
    const editId=document.getElementById('c-edit-id').value;
    try {
      App.setLoading('c-save-btn', true);
      if (editId) await API.updateCompetition(editId,{name,description:desc});
      else await API.createCompetition({name,description:desc});
      App.closeModal('competition-modal'); App.notify('Enregistré !'); CAdmin.load();
    } catch(e) { App.notify(e.message, true); }
    finally { App.setLoading('c-save-btn', false); }
  },
};

// ── Classes ───────────────────────────────────────────────
const ClassAdmin = {
  async load() {
    try {
      const classes=await API.getClasses();
      const tbody=document.getElementById('cls-tbody'), empty=document.getElementById('cls-empty');
      tbody.innerHTML='';
      if (!classes.length) { empty.style.display='block'; return; } empty.style.display='none';
      classes.forEach(c => {
        const tr=document.createElement('tr');
        tr.innerHTML=`<td style="font-weight:700">${App.esc(c.name)}</td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-xs" onclick="ClassModal.open(${c.id},'${App.esc(c.name)}')">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="ClassAdmin.delete(${c.id})">🗑️</button>
          </td>`;
        tbody.appendChild(tr);
      });
    } catch(e) {}
  },
  async delete(id) {
    if (!confirm('Supprimer cette classe ?')) return;
    try { await API.deleteClass(id); App.notify('Classe supprimée !'); ClassAdmin.load(); }
    catch(e) { App.notify(e.message, true); }
  },
};

const ClassModal = {
  open(editId, name='') {
    document.getElementById('cls-edit-id').value = editId||'';
    document.getElementById('clsmodal-title').textContent = editId ? 'Modifier la Classe' : 'Ajouter une Classe';
    document.getElementById('cls-name').value = name;
    document.getElementById('class-modal').classList.add('open');
  },
  async save() {
    const name=document.getElementById('cls-name').value.trim();
    if (!name) return App.notify('Nom requis !', true);
    const editId=document.getElementById('cls-edit-id').value;
    try {
      App.setLoading('cls-save-btn', true);
      if (editId) await API.updateClass(editId,{name});
      else await API.createClass({name});
      App.closeModal('class-modal'); App.notify('Classe enregistrée !'); ClassAdmin.load();
    } catch(e) { App.notify(e.message, true); }
    finally { App.setLoading('cls-save-btn', false); }
  },
};

// ── Exam Configs ──────────────────────────────────────────
const ECAdmin = {
  async load() {
    try {
      const ecs=await API.getExamConfigs();
      const tbody=document.getElementById('ec-tbody'), empty=document.getElementById('ec-empty');
      tbody.innerHTML='';
      if (!ecs.length) { empty.style.display='block'; return; } empty.style.display='none';
      ecs.forEach(e => {
        const opts=[];
        if(e.shuffle_questions) opts.push('🔀Q');
        if(e.shuffle_answers)   opts.push('🔀R');
        if(e.allow_retry)       opts.push('🔄');
        if(e.allow_skip)        opts.push('⏭');
        const tr=document.createElement('tr');
        tr.innerHTML=`<td style="font-weight:700">${App.esc(e.name)}</td>
          <td>${e.competition_name?`<span class="tag tag-blue">${App.esc(e.competition_name)}</span>`:'—'}</td>
          <td>${e.duration_minutes} min</td>
          <td style="font-size:.8rem">${opts.join(' ')}</td>
          <td>${e.pass_score}%</td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-xs" onclick="ExamConfigModal.open(${e.id})">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="ECAdmin.delete(${e.id})">🗑️</button>
          </td>`;
        tbody.appendChild(tr);
      });
    } catch(e) {}
  },
  async delete(id) {
    if (!confirm('Supprimer cet examen ?')) return;
    try { await API.deleteExamConfig(id); App.notify('Supprimé !'); ECAdmin.load(); }
    catch(e) { App.notify(e.message, true); }
  },
};

const ExamConfigModal = {
  async open(editId) {
    const comps=await API.getCompetitions().catch(()=>[]);
    const sel=document.getElementById('ec-competition');
    sel.innerHTML='<option value="">-- Sélectionner --</option>';
    comps.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;sel.appendChild(o);});
    document.getElementById('ec-edit-id').value=editId||'';
    document.getElementById('ecmodal-title').textContent=editId?'Modifier l\'Examen':'Configurer un Examen';
    // Reset
    ['ec-name','ec-duration','ec-pass-score','ec-max-attempts'].forEach(id=>{
      const d={'ec-name':'','ec-duration':30,'ec-pass-score':50,'ec-max-attempts':1};
      document.getElementById(id).value=d[id];
    });
    ['ec-shuffle-q','ec-shuffle-a','ec-allow-retry'].forEach(id=>document.getElementById(id).checked=false);
    ['ec-allow-skip','ec-show-feedback','ec-show-score'].forEach(id=>document.getElementById(id).checked=true);

    if (editId) {
      try {
        const e=await API.getExamConfig(editId);
        document.getElementById('ec-name').value=e.name;
        document.getElementById('ec-competition').value=e.competition_id||'';
        document.getElementById('ec-duration').value=e.duration_minutes;
        document.getElementById('ec-pass-score').value=e.pass_score;
        document.getElementById('ec-max-attempts').value=e.max_attempts;
        document.getElementById('ec-shuffle-q').checked=e.shuffle_questions;
        document.getElementById('ec-shuffle-a').checked=e.shuffle_answers;
        document.getElementById('ec-allow-retry').checked=e.allow_retry;
        document.getElementById('ec-allow-skip').checked=e.allow_skip;
        document.getElementById('ec-show-feedback').checked=e.show_feedback;
        document.getElementById('ec-show-score').checked=e.show_score;
      } catch(_) {}
    }
    document.getElementById('exam-config-modal').classList.add('open');
  },
  async save() {
    const d={
      name:document.getElementById('ec-name').value.trim(),
      competition_id:document.getElementById('ec-competition').value,
      duration_minutes:document.getElementById('ec-duration').value,
      pass_score:document.getElementById('ec-pass-score').value,
      max_attempts:document.getElementById('ec-max-attempts').value,
      shuffle_questions:document.getElementById('ec-shuffle-q').checked,
      shuffle_answers:document.getElementById('ec-shuffle-a').checked,
      allow_retry:document.getElementById('ec-allow-retry').checked,
      allow_skip:document.getElementById('ec-allow-skip').checked,
      show_feedback:document.getElementById('ec-show-feedback').checked,
      show_score:document.getElementById('ec-show-score').checked,
    };
    if (!d.name) return App.notify('Nom requis !', true);
    const editId=document.getElementById('ec-edit-id').value;
    try {
      App.setLoading('ec-save-btn', true);
      if (editId) await API.updateExamConfig(editId,d);
      else await API.createExamConfig(d);
      App.closeModal('exam-config-modal'); App.notify('Examen configuré !'); ECAdmin.load();
    } catch(e) { App.notify(e.message, true); }
    finally { App.setLoading('ec-save-btn', false); }
  },
};

// ── Questions ─────────────────────────────────────────────
const QAdmin = {
  async load() {
    try {
      const qs=await API.getQuestions();
      const tbody=document.getElementById('q-tbody'), empty=document.getElementById('q-empty');
      tbody.innerHTML='';
      if (!qs.length) { empty.style.display='block'; return; } empty.style.display='none';
      const tl={qcm:'🔘 QCM',truefalse:'✅ V/F',order:'🔢 Ordre',match:'🔗 Relier',fill:'✏️ Compléter',open:'📝 Libre'};
      const tc={qcm:'tag-blue',truefalse:'tag-green',order:'tag-orange',match:'tag-purple',fill:'tag-exam',open:'tag-red'};
      qs.forEach(q=>{
        const isImg=q.media_url&&!/\.(mp4|webm|mp3|wav|m4a)/i.test(q.media_url);
        const tr=document.createElement('tr');
        tr.innerHTML=`
          <td>${isImg?`<img src="${q.media_url}" class="thumb-preview">`:q.media_url?'🎬':'—'}</td>
          <td><span class="tag ${tc[q.q_type]||'tag-blue'}">${tl[q.q_type]||'?'}</span></td>
          <td style="max-width:220px">${App.esc((q.text||'').substring(0,70))}</td>
          <td style="font-weight:700">${q.max_score} pt${q.max_score>1?'s':''}</td>
          <td>${q.competition_name?`<span class="tag tag-blue">${App.esc(q.competition_name)}</span>`:'<span style="opacity:.4">—</span>'}</td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-xs" onclick="QModal.open(${q.id})">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="QAdmin.delete(${q.id})">🗑️</button>
          </td>`;
        tbody.appendChild(tr);
      });
    } catch(e) {}
  },
  async delete(id) {
    if (!confirm('Supprimer cette question ?')) return;
    try { await API.deleteQuestion(id); App.notify('Supprimée !'); QAdmin.load(); }
    catch(e) { App.notify(e.message, true); }
  },
};

const QModal = {
  state: { qType:'qcm', mediaType:'none', mediaFile:null, correctIdx:0, ansImgFiles:[] },

  async open(editId) {
    this.state = { qType:'qcm', mediaType:'none', mediaFile:null, correctIdx:0, ansImgFiles:[] };
    const comps=await API.getCompetitions().catch(()=>[]);
    const sel=document.getElementById('q-competition');
    sel.innerHTML='<option value="">-- Aucune --</option>';
    comps.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;sel.appendChild(o);});

    document.getElementById('q-edit-id').value='';
    document.getElementById('q-text').value='';
    document.getElementById('q-media-url').value='';
    document.getElementById('q-media-preview').innerHTML='';
    document.getElementById('qmedia-group').style.display='none';
    document.getElementById('q-max-score').value='1';
    document.getElementById('q-partial-scoring').checked=false;
    document.getElementById('q-feedback').value='';
    document.querySelectorAll('#qtype-pills .type-pill').forEach(b=>b.classList.toggle('active',b.dataset.qtype==='qcm'));
    document.querySelectorAll('#qmedia-pills .type-pill').forEach(b=>b.classList.toggle('active',b.dataset.qmedia==='none'));
    document.getElementById('qmodal-title').textContent=editId?'Modifier la Question':'Ajouter une Question';

    if (editId) {
      const q=await API.getQuestion(editId).catch(()=>null);
      if (!q) return;
      document.getElementById('q-edit-id').value=editId;
      document.getElementById('q-text').value=q.text||'';
      document.getElementById('q-competition').value=q.competition_id||'';
      document.getElementById('q-max-score').value=q.max_score||1;
      document.getElementById('q-partial-scoring').checked=q.partial_scoring;
      document.getElementById('q-feedback').value=q.feedback||'';
      this.state.qType=q.q_type||'qcm';
      this.state.correctIdx=q.correct_index||0;
      document.querySelectorAll('#qtype-pills .type-pill').forEach(b=>b.classList.toggle('active',b.dataset.qtype===this.state.qType));
      if (q.media_url) {
        const mt=/video|\.mp4/i.test(q.media_url)?'video':/audio|\.mp3|\.wav/i.test(q.media_url)?'audio':'image';
        this.state.mediaType=mt;
        document.querySelectorAll('#qmedia-pills .type-pill').forEach(b=>b.classList.toggle('active',b.dataset.qmedia===mt));
        document.getElementById('qmedia-group').style.display='block';
        if (!q.media_url.startsWith('/uploads/')) document.getElementById('q-media-url').value=q.media_url;
        this._showMediaPreview(q.media_url);
      }
      this._buildAnswerUI(q.answers||[]);
    } else {
      this._buildAnswerUI([]);
    }
    document.getElementById('question-modal').classList.add('open');
  },

  setQType(btn) {
    document.querySelectorAll('#qtype-pills .type-pill').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); this.state.qType=btn.dataset.qtype;
    this._buildAnswerUI([]);
  },
  setMediaType(btn) {
    document.querySelectorAll('#qmedia-pills .type-pill').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); this.state.mediaType=btn.dataset.qmedia;
    document.getElementById('qmedia-group').style.display=this.state.mediaType==='none'?'none':'block';
    const accepts={image:'image/*',video:'video/*',audio:'audio/*'};
    document.getElementById('q-media-file').accept=accepts[this.state.mediaType]||'image/*,video/*,audio/*';
    const icons={image:'🖼️',video:'🎬',audio:'🎵'};
    document.getElementById('q-drop-icon').textContent=icons[this.state.mediaType]||'📁';
  },
  onMediaFile(input) {
    const f=input.files[0]; if(!f) return;
    this.state.mediaFile=f;
    document.getElementById('q-media-url').value='';
    this._showMediaPreview(URL.createObjectURL(f));
  },
  onMediaUrl(url) { this.state.mediaFile=null; if(url) this._showMediaPreview(url); else document.getElementById('q-media-preview').innerHTML=''; },
  _showMediaPreview(src) {
    const p=document.getElementById('q-media-preview');
    if(!src){p.innerHTML='';return;}
    const isV=/video|\.mp4|\.webm/i.test(src), isA=/audio|\.mp3|\.wav|\.m4a/i.test(src);
    if(isV) p.innerHTML=`<video src="${src}" controls style="max-height:100px"></video>`;
    else if(isA) p.innerHTML=`<audio src="${src}" controls></audio>`;
    else p.innerHTML=`<img src="${src}" style="max-height:100px;object-fit:contain;border-radius:8px">`;
  },

  _buildAnswerUI(existing) {
    const c=document.getElementById('ans-builder-container'); c.innerHTML='';
    const type=this.state.qType;

    if (type==='qcm' || type==='truefalse') {
      const count=type==='truefalse'?2:4;
      if (type==='truefalse' && !existing.length) existing=[{text:'Vrai',img:'',is_correct:true,score:1,feedback:''},{text:'Faux',img:'',is_correct:false,score:0,feedback:''}];
      c.innerHTML=`<label class="form-label">Réponses (✅ = bonne réponse)</label><div class="ans-builder-list" id="ans-list"></div>`;
      const list=document.getElementById('ans-list');
      const defs=existing.length?existing:Array(count).fill(null).map(()=>({text:'',img:'',is_correct:false,score:0,feedback:''}));
      let correctIdx=defs.findIndex(a=>a.is_correct); if(correctIdx<0) correctIdx=0;
      this.state.correctIdx=correctIdx;
      this.state.ansImgFiles=defs.map(()=>null);

      defs.forEach((ans,i)=>{
        const isC=i===this.state.correctIdx;
        const row=document.createElement('div'); row.className='ans-builder-row'+(isC?' is-correct':''); row.id=`ans-row-${i}`;
        row.innerHTML=`
          <div class="ans-row-top">
            <button class="ans-mark-btn" onclick="QModal._markCorrect(${i})">${isC?'✅':'⬜'}</button>
            <textarea class="form-textarea" id="ans-text-${i}" placeholder="Réponse ${i+1}" rows="2" style="flex:1;min-height:60px">${App.esc(ans.text||'')}</textarea>
            ${type==='qcm'?`<div>
              <div style="font-size:.7rem;opacity:.5;margin-bottom:3px">Score partiel</div>
              <input type="number" class="ans-score-input" id="ans-score-${i}" value="${ans.score||0}" min="0" step="0.5">
            </div>`:''}
          </div>
          <input type="text" class="ans-feedback-input" id="ans-fb-${i}" placeholder="💬 Feedback pour cette réponse (optionnel)" value="${App.esc(ans.feedback||'')}">`;
        list.appendChild(row);
      });

    } else if (type==='order') {
      const count=existing.length||4;
      c.innerHTML=`<label class="form-label">Éléments à ordonner (l'ordre ici = ordre correct)</label><div class="order-builder" id="order-builder"></div>
        <button class="btn btn-ghost btn-xs" onclick="QModal._addOrderItem()" style="margin-top:8px">+ Ajouter un élément</button>`;
      const builder=document.getElementById('order-builder');
      const items=existing.length?existing:Array(4).fill(null).map((_,i)=>({text:'',img:'',position:i}));
      items.forEach((item,i)=>this._renderOrderItem(builder,item,i));

    } else if (type==='match') {
      const count=existing.length||4;
      c.innerHTML=`<label class="form-label">Paires à relier (gauche ↔ droite)</label><div class="match-builder" id="match-builder"></div>
        <button class="btn btn-ghost btn-xs" onclick="QModal._addMatchPair()" style="margin-top:8px">+ Ajouter une paire</button>`;
      const builder=document.getElementById('match-builder');
      const pairs=existing.length?existing:Array(4).fill(null).map(()=>({left_text:'',left_img:'',right_text:'',right_img:''}));
      pairs.forEach((p,i)=>this._renderMatchPair(builder,p,i));

    } else if (type==='fill') {
      c.innerHTML=`<label class="form-label">✏️ Phrase avec blancs (utilisez ___ pour chaque blanc)</label>
        <textarea class="form-textarea" id="fill-sentence" placeholder="Ex: La capitale de la France est ___ et elle compte ___ habitants." rows="3">${App.esc((existing[0]?.sentence)||q?.text||'')}</textarea>
        <div style="margin-top:8px"><label class="form-label">Mots à placer (dans l'ordre des ___)</label>
        <div id="fill-blanks-list"></div>
        <button class="btn btn-ghost btn-xs" onclick="QModal._addFillBlank()" style="margin-top:8px">+ Ajouter un mot</button></div>`;
      const blanks=(existing[0]?.blanks)||[];
      blanks.forEach((b,i)=>this._addFillBlank(b.word));

    } else if (type==='open') {
      c.innerHTML=`<label class="form-label">📝 Réponse libre — correction manuelle par le professeur</label>
        <div style="padding:14px;background:rgba(244,162,97,.08);border-radius:10px;font-size:.88rem;opacity:.8;line-height:1.6">
          ℹ️ Les questions à réponse libre ne sont pas auto-corrigées. Le score sera 0 par défaut. 
          Le professeur recevra la réponse de l'élève par email pour correction manuelle.
        </div>`;
    }
  },

  _markCorrect(idx) {
    this.state.correctIdx=idx;
    document.querySelectorAll('[id^=ans-row-]').forEach((r,i)=>{
      r.classList.toggle('is-correct',i===idx);
      const btn=r.querySelector('.ans-mark-btn');
      if(btn) btn.textContent=i===idx?'✅':'⬜';
    });
  },

  _renderOrderItem(builder, item, i) {
    const div=document.createElement('div'); div.className='order-builder-item'; div.id=`order-item-${i}`;
    div.innerHTML=`<span class="order-pos-label">${i+1}.</span>
      <textarea class="form-textarea" id="order-text-${i}" placeholder="Élément ${i+1}" rows="2" style="flex:1;min-height:50px">${App.esc(item.text||'')}</textarea>
      <button class="btn btn-ghost btn-xs" onclick="document.getElementById('order-item-${i}').remove()">✕</button>`;
    builder.appendChild(div);
  },
  _addOrderItem() {
    const builder=document.getElementById('order-builder');
    const i=builder.children.length;
    this._renderOrderItem(builder,{text:'',position:i},i);
  },
  _renderMatchPair(builder, pair, i) {
    const div=document.createElement('div'); div.className='match-builder-pair'; div.id=`match-pair-${i}`;
    div.innerHTML=`<div class="match-pair-label">Paire ${i+1}</div>
      <textarea class="form-textarea" id="match-left-${i}" placeholder="Gauche (A)" rows="2" style="min-height:50px">${App.esc(pair.left_text||'')}</textarea>
      <div style="text-align:center;opacity:.4;font-size:1.2rem">↔</div>
      <textarea class="form-textarea" id="match-right-${i}" placeholder="Droite (B)" rows="2" style="min-height:50px">${App.esc(pair.right_text||'')}</textarea>
      <button class="btn btn-ghost btn-xs" onclick="document.getElementById('match-pair-${i}').remove()" style="margin-top:4px">✕ Supprimer</button>`;
    builder.appendChild(div);
  },
  _addMatchPair() {
    const builder=document.getElementById('match-builder');
    const i=builder.children.length;
    this._renderMatchPair(builder,{left_text:'',right_text:''},i);
  },
  _addFillBlank(val='') {
    const list=document.getElementById('fill-blanks-list');
    if (!list) return;
    const i=list.children.length;
    const div=document.createElement('div'); div.style.cssText='display:flex;gap:8px;margin-bottom:6px';
    div.innerHTML=`<span style="font-family:Bangers,cursive;color:var(--exam-light);min-width:24px;padding-top:8px">${i+1}.</span>
      <input type="text" class="form-input fill-blank-word-${i}" placeholder="Mot ${i+1}" value="${App.esc(val)}" style="flex:1">
      <button class="btn btn-ghost btn-xs" onclick="this.parentElement.remove()" style="margin-top:2px">✕</button>`;
    list.appendChild(div);
  },

  async save() {
    const text=document.getElementById('q-text').value.trim();
    const compId=document.getElementById('q-competition').value;
    const editId=document.getElementById('q-edit-id').value;
    const mediaUrl=document.getElementById('q-media-url').value.trim();
    const maxScore=document.getElementById('q-max-score').value;
    const partial=document.getElementById('q-partial-scoring').checked;
    const feedback=document.getElementById('q-feedback').value.trim();
    const type=this.state.qType;

    let answers=[];
    if (type==='qcm'||type==='truefalse') {
      const rows=document.querySelectorAll('[id^=ans-row-]');
      rows.forEach((r,i)=>{
        answers.push({
          text:(document.getElementById(`ans-text-${i}`)?.value||'').trim(),
          img:'',
          is_correct:i===this.state.correctIdx,
          score:parseFloat(document.getElementById(`ans-score-${i}`)?.value||0),
          feedback:(document.getElementById(`ans-fb-${i}`)?.value||'').trim(),
        });
      });
    } else if (type==='order') {
      const items=document.querySelectorAll('[id^=order-item-]');
      items.forEach((item,i)=>{
        const txt=(document.getElementById(`order-text-${i}`)?.value||'').trim();
        if(txt) answers.push({text:txt,img:'',position:i});
      });
    } else if (type==='match') {
      const pairs=document.querySelectorAll('[id^=match-pair-]');
      pairs.forEach((pair,i)=>{
        const l=(document.getElementById(`match-left-${i}`)?.value||'').trim();
        const r=(document.getElementById(`match-right-${i}`)?.value||'').trim();
        if(l&&r) answers.push({left_text:l,left_img:'',right_text:r,right_img:''});
      });
    } else if (type==='fill') {
      const sentence=(document.getElementById('fill-sentence')?.value||'').trim();
      const blankWords=[...document.querySelectorAll('[class^=fill-blank-word-]')].map(el=>el.value.trim()).filter(Boolean);
      const blanks=blankWords.map((word,i)=>({word,position:i}));
      answers=[{sentence,blanks}];
    } else if (type==='open') {
      answers=[{model_answer:'',keywords:[]}];
    }

    if (!text && !mediaUrl && !this.state.mediaFile) return App.notify('Ajoutez un texte ou un média !', true);

    const fd=new FormData();
    fd.append('q_type',type);
    fd.append('text',text);
    fd.append('media_url',mediaUrl);
    fd.append('ans_type','text');
    fd.append('answers',JSON.stringify(answers));
    fd.append('correct_index',this.state.correctIdx);
    fd.append('max_score',maxScore);
    fd.append('partial_scoring',partial);
    fd.append('feedback',feedback);
    fd.append('competition_id',compId||'');
    if (this.state.mediaFile) fd.append('media',this.state.mediaFile);

    try {
      App.setLoading('q-save-btn', true);
      await API.saveQuestion(fd, editId||null);
      App.closeModal('question-modal'); App.notify('Question enregistrée !'); QAdmin.load();
    } catch(e) { App.notify(e.message, true); }
    finally { App.setLoading('q-save-btn', false); }
  },
};
