// frontend/public/js/api.js
const API = {
  async req(method, url, body, isForm = false) {
    const opts = { method, credentials: 'include' };
    if (body) {
      if (isForm) { opts.body = body; }
      else { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
    }
    const res  = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
  login:              pw   => API.req('POST', '/api/auth/login', { password: pw }),
  logout:             ()   => API.req('POST', '/api/auth/logout'),
  getCompetitions:    ()   => API.req('GET',  '/api/competitions'),
  getCompetition:     id   => API.req('GET',  `/api/competitions/${id}`),
  createCompetition:  d    => API.req('POST', '/api/competitions', d),
  updateCompetition:  (id,d)=> API.req('PUT', `/api/competitions/${id}`, d),
  deleteCompetition:  id   => API.req('DELETE', `/api/competitions/${id}`),
  getClasses:         ()   => API.req('GET',  '/api/classes'),
  createClass:        d    => API.req('POST', '/api/classes', d),
  updateClass:        (id,d)=> API.req('PUT', `/api/classes/${id}`, d),
  deleteClass:        id   => API.req('DELETE', `/api/classes/${id}`),
  getQuestions:       cid  => API.req('GET',  `/api/questions${cid?'?competition_id='+cid:''}`),
  getQuestion:        id   => API.req('GET',  `/api/questions/${id}`),
  saveQuestion:       (fd,id)=> API.req(id?'PUT':'POST', id?`/api/questions/${id}`:'/api/questions', fd, true),
  deleteQuestion:     id   => API.req('DELETE', `/api/questions/${id}`),
  startGame:          d    => API.req('POST', '/api/games/start', d),
  checkAnswer:        (sid,d)=> API.req('POST', `/api/games/${sid}/answer`, d),
  finishGame:         (sid,d)=> API.req('POST', `/api/games/${sid}/finish`, d),
  getGames:           ()   => API.req('GET',  '/api/games'),
  getExamConfigs:     ()   => API.req('GET',  '/api/exam-configs'),
  getExamConfig:      id   => API.req('GET',  `/api/exam-configs/${id}`),
  createExamConfig:   d    => API.req('POST', '/api/exam-configs', d),
  updateExamConfig:   (id,d)=> API.req('PUT', `/api/exam-configs/${id}`, d),
  deleteExamConfig:   id   => API.req('DELETE', `/api/exam-configs/${id}`),
  startExam:          d    => API.req('POST', '/api/exams/start', d),
  submitExam:         (sid,d)=> API.req('POST', `/api/exams/${sid}/submit`, d),
  getExamResults:     ()   => API.req('GET',  '/api/exams'),
  getExamResult:      id   => API.req('GET',  `/api/exams/${id}`),
  getEmailConfig:     ()   => API.req('GET',  '/api/email-config'),
  saveEmailConfig:    d    => API.req('PUT',  '/api/email-config', d),
  testEmail:          ()   => API.req('POST', '/api/email-config/test'),
};
