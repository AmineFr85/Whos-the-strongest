// frontend/public/js/game.js
const Game = {
  // State
  sessionId: null,
  questions: [],
  currentQ: 0,
  score1: 0,
  score2: 0,
  team1: '', team2: '',
  t1Answered: false, t2Answered: false,
  t1Choice: -1, t2Choice: -1,
  timerInterval: null,
  timeLeft: 25,

  // ── Load competitions into setup dropdown ──────────────
  async loadCompetitions() {
    try {
      const comps = await API.getCompetitions();
      const sel = document.getElementById('competition-select');
      sel.innerHTML = '<option value="">-- Sélectionner --</option>';
      comps.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.name} (${c.question_count} questions)`;
        sel.appendChild(o);
      });
    } catch (e) {
      App.notify('Impossible de charger les compétitions.', true);
    }
  },

  // ── Start ─────────────────────────────────────────────
  async start() {
    const t1 = document.getElementById('team1-name').value.trim();
    const t2 = document.getElementById('team2-name').value.trim();
    const compId = document.getElementById('competition-select').value;
    if (!t1 || !t2) return App.notify('Saisissez les noms des deux équipes !', true);
    if (!compId)    return App.notify('Choisissez une compétition !', true);

    try {
      App.setLoading(null, true); // visual feedback via btn disabled manually
      const btn = document.querySelector('#setup-screen .btn-primary');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Chargement…'; }

      const { session, questions } = await API.startGame({
        competition_id: compId, team1_name: t1, team2_name: t2
      });

      this.sessionId = session.id;
      this.questions = questions;
      this.team1 = t1; this.team2 = t2;
      this.score1 = 0; this.score2 = 0;
      this.currentQ = 0;

      // Update header names
      document.getElementById('game-t1-name').textContent = t1;
      document.getElementById('game-t2-name').textContent = t2;
      document.getElementById('ptag1').textContent = t1;
      document.getElementById('ptag2').textContent = t2;

      App.showScreen('game-screen');
      this.loadQuestion();
    } catch (e) {
      App.notify(e.message, true);
    } finally {
      const btn = document.querySelector('#setup-screen .btn-primary');
      if (btn) { btn.disabled = false; btn.textContent = '🚀 Lancer la Partie !'; }
    }
  },

  // ── Load current question ─────────────────────────────
  loadQuestion() {
    if (this.currentQ >= this.questions.length) { this.end(); return; }

    const q = this.questions[this.currentQ];
    this.t1Answered = false; this.t2Answered = false;
    this.t1Choice = -1; this.t2Choice = -1;

    document.getElementById('q-counter').textContent =
      `Q ${this.currentQ + 1}/${this.questions.length}`;
    document.getElementById('panel-t1').className = 'question-panel red-panel';
    document.getElementById('panel-t2').className = 'question-panel blue-panel';
    document.getElementById('overlay-1').classList.remove('show');
    document.getElementById('overlay-2').classList.remove('show');

    this.renderQBody('qbody1', q);
    this.renderQBody('qbody2', q);
    this.renderAnswers('answers-1', q, 1);
    this.renderAnswers('answers-2', q, 2);
    this.startTimer();
  },

  renderQBody(elId, q) {
    const el = document.getElementById(elId);
    const labels = { text:'📝 Texte', image:'🖼️ Image', video:'🎬 Vidéo', audio:'🎵 Audio', mixed:'🔀 Mixte' };
    const cls    = { text:'badge-text', image:'badge-image', video:'badge-video', audio:'badge-audio', mixed:'badge-mixed' };
    let html = `<span class="q-type-badge ${cls[q.q_type]||'badge-text'}">${labels[q.q_type]||'Texte'}</span>`;
    if (q.text) html += `<div class="question-text-el">${App.esc(q.text)}</div>`;
    if (q.media_url && q.q_type !== 'text') {
      const src = q.media_url;
      const isV = /video|\.mp4|\.webm|\.mov/i.test(src);
      const isA = /audio|\.mp3|\.wav|\.m4a/i.test(src);
      html += '<div class="q-media-wrap">';
      if (isV)      html += `<video src="${src}" controls></video>`;
      else if (isA) html += `<audio src="${src}" controls></audio>`;
      else          html += `<img src="${src}" alt="question media">`;
      html += '</div>';
    }
    el.innerHTML = html;
  },

  renderAnswers(containerId, q, team) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    q.answers.forEach((ans, idx) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      let inner = '';
      if (ans.img)  inner += `<img src="${ans.img}" alt="">`;
      if (ans.text) inner += `<span>${App.esc(ans.text)}</span>`;
      if (!ans.img && !ans.text) inner = `Réponse ${idx + 1}`;
      btn.innerHTML = inner;
      btn.onclick = () => this.handleAnswer(team, idx, q);
      container.appendChild(btn);
    });
  },

  // ── Answer handling ───────────────────────────────────
  handleAnswer(team, idx, q) {
    if (team === 1 && this.t1Answered) return;
    if (team === 2 && this.t2Answered) return;

    if (team === 1) { this.t1Answered = true; this.t1Choice = idx; }
    else            { this.t2Answered = true; this.t2Choice = idx; }

    // Visually mark as selected — no correct/wrong yet
    document.querySelectorAll(`#answers-${team} .answer-btn`).forEach((b, i) => {
      b.disabled = true;
      if (i === idx) b.classList.add('selected');
    });

    // Show waiting overlay on the panel that just answered
    const otherDone = team === 1 ? this.t2Answered : this.t1Answered;
    if (!otherDone) {
      document.getElementById(`overlay-${team}`).classList.add('show');
    }

    // Both answered → reveal
    if (this.t1Answered && this.t2Answered) {
      clearInterval(this.timerInterval);
      document.getElementById('overlay-1').classList.remove('show');
      document.getElementById('overlay-2').classList.remove('show');
      setTimeout(() => this.reveal(q), 350);
    }
  },

  // ── Reveal (calls API to get correct_index) ───────────
  async reveal(q) {
    try {
      const { correct_index } = await API.checkAnswer(this.sessionId, {
        question_id: q.id,
        team: 1,
        choice_index: this.t1Choice,
      });

      const t1ok = this.t1Choice === correct_index;
      const t2ok = this.t2Choice === correct_index;

      // Reveal team 1 answers
      document.querySelectorAll('#answers-1 .answer-btn').forEach((b, i) => {
        b.classList.remove('selected');
        if (i === correct_index) b.classList.add('correct');
        else if (i === this.t1Choice) b.classList.add('wrong');
      });
      // Reveal team 2 answers
      document.querySelectorAll('#answers-2 .answer-btn').forEach((b, i) => {
        b.classList.remove('selected');
        if (i === correct_index) b.classList.add('correct');
        else if (i === this.t2Choice) b.classList.add('wrong');
      });

      document.getElementById('panel-t1').classList.add(t1ok ? 'answered-correct' : 'answered-wrong');
      document.getElementById('panel-t2').classList.add(t2ok ? 'answered-correct' : 'answered-wrong');

      if (t1ok) this.score1++;
      if (t2ok) this.score2++;
      this.updateScores();
      this.updateRope();

      // Build reveal popup
      const mk = (name, ok, cls) => `
        <div class="reveal-team-card ${ok ? 'winner' : ''}">
          <div class="reveal-result-icon">${ok ? '✅' : '❌'}</div>
          <div class="reveal-team-name ${cls}">${App.esc(name)}</div>
          <div class="reveal-label">${ok ? 'Bonne réponse !' : 'Mauvaise réponse'}</div>
        </div>`;
      document.getElementById('reveal-results').innerHTML =
        mk(this.team1, t1ok, 'red') + mk(this.team2, t2ok, 'blue');

      const correctAns = q.answers[correct_index];
      document.getElementById('reveal-correct-ans').innerHTML =
        `✅ Bonne réponse : <strong>${App.esc(correctAns?.text || '(image)')}</strong>`;

      const isLast = this.currentQ + 1 >= this.questions.length;
      document.getElementById('reveal-next-btn').textContent =
        isLast ? '🏁 Résultats Finaux' : 'Suivant ➜';

      document.getElementById('round-reveal').classList.add('show');
    } catch (e) {
      App.notify('Erreur lors de la vérification de la réponse.', true);
    }
  },

  continueRound() {
    document.getElementById('round-reveal').classList.remove('show');
    this.currentQ++;
    this.loadQuestion();
  },

  // ── Timer ─────────────────────────────────────────────
  startTimer() {
    clearInterval(this.timerInterval);
    this.timeLeft = 25;
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      this.updateTimerDisplay();
      if (this.timeLeft <= 0) {
        clearInterval(this.timerInterval);
        const q = this.questions[this.currentQ];
        if (!this.t1Answered) { this.t1Answered = true; this.t1Choice = -1; }
        if (!this.t2Answered) { this.t2Answered = true; this.t2Choice = -1; }
        document.getElementById('overlay-1').classList.remove('show');
        document.getElementById('overlay-2').classList.remove('show');
        document.querySelectorAll('#answers-1 .answer-btn,#answers-2 .answer-btn')
          .forEach(b => b.disabled = true);
        setTimeout(() => this.reveal(q), 300);
      }
    }, 1000);
  },

  updateTimerDisplay() {
    const el = document.getElementById('timer-display');
    el.textContent = `⏱ ${this.timeLeft}s`;
    el.className = 'timer-display' + (this.timeLeft <= 5 ? ' urgent' : '');
  },

  updateScores() {
    document.getElementById('score-t1').textContent = this.score1;
    document.getElementById('score-t2').textContent = this.score2;
  },

  updateRope() {
    let pct = 50;
    const tot = this.score1 + this.score2;
    if (tot > 0) { pct = 50 - (this.score1 - this.score2) * 7; pct = Math.max(8, Math.min(92, pct)); }
    document.getElementById('rope-flag').style.left = pct + '%';
  },

  confirmEnd() {
    if (confirm('Terminer la partie maintenant ?')) {
      clearInterval(this.timerInterval);
      document.getElementById('round-reveal').classList.remove('show');
      this.end();
    }
  },

  async end() {
    clearInterval(this.timerInterval);
    // Save scores
    try {
      await API.finishGame(this.sessionId, { score1: this.score1, score2: this.score2 });
    } catch (_) {}

    App.showScreen('result-screen');
    document.getElementById('res-name1').textContent = this.team1;
    document.getElementById('res-name2').textContent = this.team2;
    document.getElementById('res-score1').textContent = this.score1;
    document.getElementById('res-score2').textContent = this.score2;

    const w = document.getElementById('result-winner');
    const t = document.getElementById('result-trophy');
    if (this.score1 > this.score2)      { w.textContent = this.team1; w.className = 'winner-name red';  t.textContent = '🏆'; this.launchConfetti(); }
    else if (this.score2 > this.score1) { w.textContent = this.team2; w.className = 'winner-name blue'; t.textContent = '🏆'; this.launchConfetti(); }
    else                                { w.textContent = 'ÉGALITÉ !'; w.className = 'winner-name draw'; t.textContent = '🤝'; }
  },

  launchConfetti() {
    const c = document.getElementById('confetti-container'); c.innerHTML = '';
    const colors = ['#e63946','#f4a261','#2a9d8f','#6bc5e8','#ffffff','#ffd700'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('div'); p.className = 'confetti-piece';
      p.style.cssText = `left:${Math.random()*100}%;background:${colors[~~(Math.random()*colors.length)]};width:${6+Math.random()*10}px;height:${6+Math.random()*10}px;border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${2+Math.random()*3}s;animation-delay:${Math.random()*2}s;`;
      c.appendChild(p);
    }
  },
};
