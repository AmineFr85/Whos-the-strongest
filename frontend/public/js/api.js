// frontend/public/js/api.js  –  Thin API wrapper
const API = {
  async req(method, url, body, isFormData = false) {
    const opts = { method, credentials: 'include' };
    if (body) {
      if (isFormData) { opts.body = body; }
      else { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
    }
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  // Auth
  login:  (password)      => API.req('POST', '/api/auth/login',  { password }),
  logout: ()              => API.req('POST', '/api/auth/logout'),
  me:     ()              => API.req('GET',  '/api/auth/me'),

  // Competitions
  getCompetitions:    ()   => API.req('GET',    '/api/competitions'),
  createCompetition:  (d)  => API.req('POST',   '/api/competitions', d),
  updateCompetition:  (id,d)=> API.req('PUT',   `/api/competitions/${id}`, d),
  deleteCompetition:  (id) => API.req('DELETE', `/api/competitions/${id}`),

  // Questions
  getQuestions:   (cid)    => API.req('GET',    `/api/questions${cid ? '?competition_id='+cid : ''}`),
  deleteQuestion: (id)     => API.req('DELETE', `/api/questions/${id}`),
  saveQuestion:   (fd, id) => API.req(id ? 'PUT' : 'POST',
                                       id ? `/api/questions/${id}` : '/api/questions',
                                       fd, true),

  // Games
  startGame:      (d)      => API.req('POST', '/api/games/start', d),
  checkAnswer:    (sid, d) => API.req('POST', `/api/games/${sid}/answer`, d),
  finishGame:     (sid, d) => API.req('POST', `/api/games/${sid}/finish`, d),
  getHistory:     ()       => API.req('GET',  '/api/games'),
};
