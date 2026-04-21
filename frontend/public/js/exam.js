// frontend/public/js/exam.js
const Exam = {
  sessionId: null, config: null, questions: [], currentQ: 0,
  answers: [], timerInterval: null, timeLeft: 0,
  studentName: '', examName: '',

  // ── Load entry screen data ────────────────────────────
  async loadEntry() {
    try {
      const [classes, exams] = await Promise.all([API.getClasses(), API.getExamConfigs()]);
      const cSel = document.getElementById('exam-class-select');
      cSel.innerHTML = '<option value="">-- Sélectionner votre classe --</option>';
      classes.forEach(c => { const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; cSel.appendChild(o); });
      const eSel = document.getElementById('exam-config-select');
      eSel.innerHTML = '<option value="">-- Sélectionner l\'examen --</option>';
      exams.forEach(e => { const o=document.createElement('option'); o.value=e.id; o.textContent=e.name; eSel.appendChild(o); });
      eSel.onchange = () => this.showExamInfo(eSel.value, exams);
    } catch(e) { App.notify('Erreur chargement données.', true); }
  },

  showExamInfo(examId, exams) {
    const info = document.getElementById('exam-config-info');
    const exam = exams.find(e => String(e.id) === String(examId));
    if (!exam) { info.style.display='none'; return; }
    info.style.display = 'block';
    info.innerHTML = `
      <strong>📋 ${App.esc(exam.name)}</strong><br>
      ⏱ Durée : <strong>${exam.duration_minutes} minutes</strong> &nbsp;|&nbsp;
      🎯 Seuil de réussite : <strong>${exam.pass_score}%</strong><br>
      ${exam.shuffle_questions?'🔀 Questions mélangées &nbsp;':''}
      ${exam.shuffle_answers?'🔀 Réponses mélangées &nbsp;':''}
      ${exam.allow_skip?'⏭ Peut passer des questions &nbsp;':''}
      ${exam.allow_retry?'🔄 Rattrapage autorisé':''}`;
  },

  async start() {
    const name    = document.getElementById('exam-student-name').value.trim();
    const classId = document.getElementById('exam-class-select').value;
    const email   = document.getElementById('exam-student-email').value.trim();
    const examId  = document.getElementById('exam-config-select').value;
    if (!name)   return App.notify('Saisissez votre nom !', true);
    if (!classId) return App.notify('Sélectionnez votre classe !', true);
    if (!examId)  return App.notify('Sélectionnez un examen !', true);
    try {
      App.setLoading('start-exam-btn', true);
      const { session, questions, config } = await API.startExam({
        exam_config_id: examId, student_name: name, student_email: email, class_id: classId
      });
      this.sessionId = session.id; this.questions = questions; this.config = config;
      this.studentName = name; this.examName = config.name;
      this.currentQ = 0;
      this.answers = questions.map(q => ({ question_id: q.id, given_answer:'', answer_index:-1,
        order_indices:[], match_pairs:[], fill_answers:[], skipped: false }));
      document.getElementById('exam-title-display').textContent = config.name;
      document.getElementById('exam-student-display').textContent = `${name}`;
      document.getElementById('exam-skip-btn').style.display = config.allow_skip ? '' : 'none';
      this.timeLeft = config.duration_minutes * 60;
      App.showScreen('exam-screen');
      this.renderQuestion();
      this.startTimer();
    } catch(e) { App.notify(e.message, true); }
    finally { App.setLoading('start-exam-btn', false); }
  },

  // ── Timer ─────────────────────────────────────────────
  startTimer() {
    clearInterval(this.timerInterval);
    this.updateTimer();
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      this.updateTimer();
      if (this.timeLeft <= 0) { clearInterval(this.timerInterval); this.submit(); }
    }, 1000);
  },
  updateTimer() {
    const m = Math.floor(this.timeLeft / 60);
    const s = this.timeLeft % 60;
    const el = document.getElementById('exam-timer');
    el.textContent = `⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    el.className = 'exam-timer' + (this.timeLeft <= 60 ? ' urgent' : '');
  },

  // ── Render question ───────────────────────────────────
  renderQuestion() {
    const q = this.questions[this.currentQ];
    const ans = this.answers[this.currentQ];
    const total = this.questions.length;

    document.getElementById('exam-q-number').textContent = `Q ${this.currentQ+1}/${total}`;
    document.getElementById('exam-q-score').textContent = `${q.max_score} pt${q.max_score>1?'s':''}`;
    const typeLabels = {qcm:'QCM',truefalse:'Vrai/Faux',order:'Mettre en ordre',match:'Relier',fill:'Compléter',open:'Réponse libre'};
    document.getElementById('exam-q-type-badge').textContent = typeLabels[q.q_type]||'QCM';

    // Question text
    document.getElementById('exam-question-text').textContent = q.text || '';

    // Media
    const mediaEl = document.getElementById('exam-q-media');
    if (q.media_url) {
      const src = q.media_url;
      const isV = /video|\.mp4|\.webm/i.test(src);
      const isA = /audio|\.mp3|\.wav|\.m4a/i.test(src);
      if (isV)      mediaEl.innerHTML = `<div class="q-media-wrap"><video src="${src}" controls></video></div>`;
      else if (isA) mediaEl.innerHTML = `<div class="q-media-wrap"><audio src="${src}" controls></audio></div>`;
      else          mediaEl.innerHTML = `<div class="q-media-wrap"><img src="${src}" alt=""></div>`;
    } else { mediaEl.innerHTML = ''; }

    // Answers
    const container = document.getElementById('exam-answers-container');
    container.innerHTML = '';
    switch (q.q_type) {
      case 'qcm':       this.renderQcm(container, q, ans); break;
      case 'truefalse': this.renderTrueFalse(container, q, ans); break;
      case 'order':     this.renderOrder(container, q, ans); break;
      case 'match':     this.renderMatch(container, q, ans); break;
      case 'fill':      this.renderFill(container, q, ans); break;
      case 'open':      this.renderOpen(container, q, ans); break;
    }

    // Progress bar & dots
    const pct = ((this.currentQ+1)/total)*100;
    document.getElementById('exam-progress-fill').style.width = pct+'%';
    document.getElementById('exam-q-progress').textContent = `${this.currentQ+1}/${total}`;
    this.renderDots();
  },

  renderDots() {
    const dots = document.getElementById('exam-q-dots');
    dots.innerHTML = '';
    this.questions.forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'exam-q-dot' + (i===this.currentQ?' current':'') +
        (this.answers[i]?.answer_index>-1 || this.answers[i]?.given_answer || this.answers[i]?.order_indices?.length || this.answers[i]?.match_pairs?.length || this.answers[i]?.fill_answers?.some(f=>f) ? ' answered' : '') +
        (this.answers[i]?.skipped ? ' skipped' : '');
      d.textContent = i+1;
      d.onclick = () => { this.saveCurrentAnswer(); this.currentQ=i; this.renderQuestion(); };
      dots.appendChild(d);
    });
  },

  // ── QCM ──────────────────────────────────────────────
  renderQcm(container, q, ans) {
    const grid = document.createElement('div'); grid.className = 'exam-answers-qcm';
    q.answers.forEach((a, idx) => {
      const btn = document.createElement('button');
      btn.className = 'exam-answer-opt' + (ans.answer_index===idx?' selected':'');
      let inner = '';
      if (a.img)  inner += `<img src="${a.img}" alt="">`;
      if (a.text) inner += App.esc(a.text);
      btn.innerHTML = inner;
      btn.onclick = () => {
        ans.answer_index = idx;
        container.querySelectorAll('.exam-answer-opt').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      grid.appendChild(btn);
    });
    container.appendChild(grid);
  },

  // ── True/False ────────────────────────────────────────
  renderTrueFalse(container, q, ans) {
    const div = document.createElement('div'); div.className = 'exam-tf-opts';
    q.answers.forEach((a, idx) => {
      const btn = document.createElement('button');
      btn.className = 'exam-answer-opt' + (ans.answer_index===idx?' selected':'');
      btn.textContent = a.text;
      btn.onclick = () => {
        ans.answer_index = idx;
        div.querySelectorAll('.exam-answer-opt').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
      };
      div.appendChild(btn);
    });
    container.appendChild(div);
  },

  // ── Order (drag & drop) ───────────────────────────────
  renderOrder(container, q, ans) {
    const items = ans.order_indices.length ? ans.order_indices.map(i=>q.answers[i]) : [...q.answers];
    const indices = ans.order_indices.length ? [...ans.order_indices] : q.answers.map((_,i)=>i);
    const list = document.createElement('div'); list.className = 'order-list';
    let dragSrc = null;

    const rebuild = () => {
      list.innerHTML = '';
      indices.forEach((origIdx, pos) => {
        const item = q.answers[origIdx];
        const div = document.createElement('div'); div.className = 'order-item';
        div.draggable = true;
        div.dataset.pos = pos;
        div.innerHTML = `<span class="order-handle">⠿</span><span class="order-num">${pos+1}.</span><span>${App.esc(item.text||'')}</span>`;
        div.addEventListener('dragstart', e => { dragSrc=pos; div.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
        div.addEventListener('dragend', () => div.classList.remove('dragging'));
        div.addEventListener('dragover', e => { e.preventDefault(); div.classList.add('drag-over'); });
        div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
        div.addEventListener('drop', e => {
          e.preventDefault(); div.classList.remove('drag-over');
          if (dragSrc===null || dragSrc===pos) return;
          const tmp = indices[dragSrc]; indices[dragSrc]=indices[pos]; indices[pos]=tmp;
          ans.order_indices = [...indices]; rebuild();
        });
        list.appendChild(div);
      });
    };
    rebuild();
    container.appendChild(list);
    if (!ans.order_indices.length) ans.order_indices = [...indices];
    const hint = document.createElement('p');
    hint.style.cssText='font-size:.78rem;opacity:.5;margin-top:10px;text-align:center';
    hint.textContent = '⠿ Glissez-déposez les éléments pour les ordonner';
    container.appendChild(hint);
  },

  // ── Match (relier) ────────────────────────────────────
  renderMatch(container, q, ans) {
    // Build left/right shuffled arrays (right side shuffled visually)
    const left  = q.answers.map((a,i) => ({ text: a.left_text,  origIdx: i }));
    const right = q.answers.map((a,i) => ({ text: a.right_text, origIdx: i })).sort(()=>Math.random()-.5);
    let selectedLeft = -1;
    const pairs = ans.match_pairs.length ? [...ans.match_pairs] : [];

    const wrapper = document.createElement('div');

    const renderPairs = () => {
      wrapper.innerHTML = '';
      // Pairs display
      if (pairs.length) {
        const pairsDiv = document.createElement('div'); pairsDiv.className = 'match-pairs-display';
        pairs.forEach((p, pi) => {
          const leftItem  = left.find(l=>l.origIdx===p.left_idx);
          const rightItem = right.find(r=>r.origIdx===p.right_idx);
          const chip = document.createElement('div'); chip.className = 'match-pair-chip';
          chip.innerHTML = `<strong>${App.esc(leftItem?.text||'')}</strong> ↔ ${App.esc(rightItem?.text||'')}
            <span class="match-pair-remove" onclick="this.closest('.match-pair-chip').remove()">✕</span>`;
          chip.querySelector('.match-pair-remove').onclick = () => {
            pairs.splice(pi,1); ans.match_pairs=[...pairs]; renderPairs();
          };
          pairsDiv.appendChild(chip);
        });
        wrapper.appendChild(pairsDiv);
      }

      // Remaining items to match
      const usedLeft  = pairs.map(p=>p.left_idx);
      const usedRight = pairs.map(p=>p.right_idx);
      const remLeft   = left.filter(l=>!usedLeft.includes(l.origIdx));
      const remRight  = right.filter(r=>!usedRight.includes(r.origIdx));

      if (!remLeft.length) { const done=document.createElement('div'); done.style.cssText='text-align:center;padding:16px;color:var(--exam-light);font-weight:700'; done.textContent='✅ Tous les éléments reliés !'; wrapper.appendChild(done); return; }

      const grid = document.createElement('div'); grid.className = 'match-container';
      const leftCol=document.createElement('div'); leftCol.className='match-col';
      const rightCol=document.createElement('div'); rightCol.className='match-col';
      leftCol.innerHTML='<div class="match-col-title">Colonne A</div>';
      rightCol.innerHTML='<div class="match-col-title">Colonne B</div>';

      let selLeft = -1;
      remLeft.forEach(l => {
        const el=document.createElement('div'); el.className='match-item';
        el.textContent=l.text;
        el.onclick=()=>{ selLeft=l.origIdx; leftCol.querySelectorAll('.match-item').forEach(x=>x.classList.remove('selected')); el.classList.add('selected'); };
        leftCol.appendChild(el);
      });
      remRight.forEach(r => {
        const el=document.createElement('div'); el.className='match-item';
        el.textContent=r.text;
        el.onclick=()=>{
          if (selLeft<0) return App.notify('Sélectionnez d\'abord un élément de gauche !', true);
          pairs.push({left_idx:selLeft, right_idx:r.origIdx});
          ans.match_pairs=[...pairs]; selLeft=-1; renderPairs();
        };
        rightCol.appendChild(el);
      });
      grid.appendChild(leftCol);
      const arrow=document.createElement('div'); arrow.style.cssText='display:flex;align-items:center;justify-content:center;font-size:1.5rem;opacity:.4;padding-top:32px'; arrow.textContent='→';
      grid.appendChild(arrow);
      grid.appendChild(rightCol);
      wrapper.appendChild(grid);
    };
    renderPairs();
    container.appendChild(wrapper);
  },

  // ── Fill blanks ───────────────────────────────────────
  renderFill(container, q, ans) {
    const data = q.answers[0];
    if (!data) return;
    const blanks = data.blanks || [];
    if (!ans.fill_answers.length) ans.fill_answers = blanks.map(()=>'');

    // Replace ___ with input fields
    let sentence = App.esc(data.sentence || q.text || '');
    let blankIdx = 0;
    sentence = sentence.replace(/___/g, () => {
      const i = blankIdx++;
      const val = App.esc(ans.fill_answers[i]||'');
      return `<input class="fill-blank" id="fill-blank-${i}" value="${val}" placeholder="___" style="width:${Math.max(60,(val.length||3)*12)}px" oninput="Exam._updateFill(${i},this.value)">`;
    });
    const sentDiv = document.createElement('div'); sentDiv.className='fill-sentence';
    sentDiv.innerHTML = sentence;
    container.appendChild(sentDiv);

    // Word bank (shuffled)
    if (blanks.length) {
      const bankDiv = document.createElement('div'); bankDiv.className='fill-word-bank';
      const bankLabel=document.createElement('div'); bankLabel.style.cssText='width:100%;font-size:.72rem;font-weight:700;letter-spacing:1px;opacity:.5;margin-bottom:4px';
      bankLabel.textContent='BANQUE DE MOTS'; bankDiv.appendChild(bankLabel);
      [...blanks].sort(()=>Math.random()-.5).forEach(b => {
        const chip=document.createElement('span'); chip.className='fill-word-chip';
        chip.textContent=b.word;
        chip.onclick=()=>{
          const emptyIdx = ans.fill_answers.findIndex(f=>!f);
          if (emptyIdx<0) return;
          Exam._updateFill(emptyIdx, b.word);
          const inp=document.getElementById(`fill-blank-${emptyIdx}`);
          if (inp) inp.value=b.word;
        };
        bankDiv.appendChild(chip);
      });
      container.appendChild(bankDiv);
    }
  },
  _updateFill(idx, val) {
    if (!Exam.answers[Exam.currentQ].fill_answers) Exam.answers[Exam.currentQ].fill_answers=[];
    Exam.answers[Exam.currentQ].fill_answers[idx] = val;
  },

  // ── Open text ─────────────────────────────────────────
  renderOpen(container, q, ans) {
    const ta=document.createElement('textarea'); ta.className='open-textarea';
    ta.placeholder='Rédigez votre réponse ici...';
    ta.value=ans.given_answer||'';
    ta.rows=6;
    ta.oninput=()=>{ ans.given_answer=ta.value; };
    container.appendChild(ta);
    const note=document.createElement('p'); note.style.cssText='font-size:.78rem;opacity:.5;margin-top:8px';
    note.textContent='💡 Cette réponse sera évaluée manuellement par le professeur.';
    container.appendChild(note);
  },

  // ── Navigation ────────────────────────────────────────
  saveCurrentAnswer() { /* answers updated in real-time */ },

  nextQ() {
    if (this.currentQ < this.questions.length-1) { this.currentQ++; this.renderQuestion(); }
    else this.confirmSubmit();
  },
  prevQ() {
    if (this.currentQ > 0) { this.currentQ--; this.renderQuestion(); }
  },
  skipQ() {
    this.answers[this.currentQ].skipped = true;
    this.nextQ();
  },

  confirmSubmit() {
    const answered = this.answers.filter(a => a.answer_index>-1 || a.given_answer || a.order_indices.length || a.match_pairs.length || a.fill_answers.some(f=>f)).length;
    const total    = this.questions.length;
    const unanswered = total - answered;
    const msg = unanswered > 0
      ? `Vous avez ${unanswered} question(s) sans réponse. Terminer quand même ?`
      : `Terminer et soumettre l'examen ?`;
    if (confirm(msg)) { clearInterval(this.timerInterval); this.submit(); }
  },

  async submit() {
    clearInterval(this.timerInterval);
    try {
      App.setLoading(null, true);
      const payload = this.answers.map(a => ({
        question_id:   a.question_id,
        answer_index:  a.answer_index,
        given_answer:  a.given_answer,
        order_indices: a.order_indices,
        match_pairs:   a.match_pairs,
        fill_answers:  a.fill_answers,
      }));
      const result = await API.submitExam(this.sessionId, { answers: payload });
      this.showResult(result);
    } catch(e) { App.notify(e.message, true); }
  },

  showResult(result) {
    App.showScreen('exam-result-screen');
    const pct = result.percentage?.toFixed(1) || '0';
    const ring = document.getElementById('exam-score-ring');
    ring.className = 'exam-score-ring ' + (result.passed ? 'passed' : 'failed');
    document.getElementById('exam-score-pct').textContent = pct + '%';
    const status = document.getElementById('exam-result-status');
    status.textContent = result.passed ? '✅ Réussi !' : '❌ Non réussi';
    status.className   = 'exam-result-status ' + (result.passed ? 'passed' : 'failed');
    document.getElementById('exam-score-detail').textContent = `${result.score} / ${result.max_score} points — Seuil : ${result.pass_score}%`;
    document.getElementById('exam-email-sent').textContent = '📧 Un compte-rendu a été envoyé au professeur.';

    if (result.passed) this.confetti();

    // Answers review
    if (result.show_feedback !== false && result.answers) {
      const rev = document.getElementById('exam-answers-review');
      rev.innerHTML = '<h3 style="margin-bottom:12px;color:var(--exam-light)">📋 Détail des réponses</h3>';
      result.answers.forEach((a, i) => {
        const scorePct = a.max_score > 0 ? a.score / a.max_score : 0;
        const cls = scorePct>=1 ? 'correct' : scorePct>0 ? 'partial' : 'wrong';
        const item = document.createElement('div'); item.className = `exam-review-item ${cls}`;
        item.innerHTML = `
          <div class="exam-review-q">${i+1}. ${App.esc(a.question_text||'')}</div>
          <div class="exam-review-ans">Réponse : ${App.esc(a.given_answer||'—')}</div>
          <div class="exam-review-score" style="color:${cls==='correct'?'var(--green)':cls==='partial'?'var(--gold)':'var(--red)'}">
            ${a.score} / ${a.max_score} pt${a.max_score>1?'s':''}
          </div>
          ${a.feedback ? `<div class="exam-review-feedback">💬 ${App.esc(a.feedback)}</div>` : ''}`;
        rev.appendChild(item);
      });
    }
  },

  confetti() {
    const c=document.getElementById('exam-confetti'); c.innerHTML='';
    const colors=['#52b788','#f4a261','#2a9d8f','#ffffff','#ffd700'];
    for(let i=0;i<60;i++){
      const p=document.createElement('div'); p.className='confetti-piece';
      p.style.cssText=`left:${Math.random()*100}%;background:${colors[~~(Math.random()*colors.length)]};width:${6+Math.random()*10}px;height:${6+Math.random()*10}px;border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${2+Math.random()*3}s;animation-delay:${Math.random()*2}s;`;
      c.appendChild(p);
    }
  },
};
