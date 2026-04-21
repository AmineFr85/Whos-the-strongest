// backend/db/init.js
require('dotenv').config();
const pool = require('./pool');

async function init() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Competitions ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS competitions (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(120) NOT NULL,
        description TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );`);

    // ── Classes ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(80) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`);

    // ── Questions (enriched) ──────────────────────────────
    // q_type: qcm | truefalse | order | match | fill | open
    // ans_type: text | image | mixed
    // answers JSONB structure varies by q_type:
    //   qcm/truefalse : [{text, img, is_correct, score, feedback}]
    //   order         : [{text, img, position}]
    //   match         : [{left_text, left_img, right_text, right_img}]
    //   fill          : [{sentence, blanks:[{word, position}]}]
    //   open          : [{model_answer, keywords:[]}]
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id              SERIAL PRIMARY KEY,
        competition_id  INT REFERENCES competitions(id) ON DELETE SET NULL,
        q_type          VARCHAR(20) NOT NULL DEFAULT 'qcm',
        text            TEXT,
        media_url       TEXT,
        ans_type        VARCHAR(10) NOT NULL DEFAULT 'text',
        answers         JSONB NOT NULL DEFAULT '[]',
        correct_index   SMALLINT DEFAULT 0,
        max_score       NUMERIC(5,2) DEFAULT 1,
        partial_scoring BOOLEAN DEFAULT FALSE,
        feedback        TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );`);

    // ── Exam configurations ───────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_configs (
        id                  SERIAL PRIMARY KEY,
        competition_id      INT REFERENCES competitions(id) ON DELETE CASCADE,
        name                VARCHAR(120) NOT NULL,
        duration_minutes    INT DEFAULT 30,
        shuffle_questions   BOOLEAN DEFAULT FALSE,
        shuffle_answers     BOOLEAN DEFAULT FALSE,
        allow_retry         BOOLEAN DEFAULT FALSE,
        allow_skip          BOOLEAN DEFAULT FALSE,
        show_feedback       BOOLEAN DEFAULT TRUE,
        show_score          BOOLEAN DEFAULT TRUE,
        max_attempts        INT DEFAULT 1,
        pass_score          NUMERIC(5,2) DEFAULT 50,
        created_at          TIMESTAMPTZ DEFAULT NOW()
      );`);

    // ── Email / SMTP configuration ────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_config (
        id          SERIAL PRIMARY KEY,
        smtp_host   VARCHAR(120),
        smtp_port   INT DEFAULT 587,
        smtp_user   VARCHAR(120),
        smtp_pass   VARCHAR(255),
        smtp_from   VARCHAR(120),
        prof_email  VARCHAR(255),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );`);

    // ── Exam sessions ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_sessions (
        id            SERIAL PRIMARY KEY,
        exam_config_id INT REFERENCES exam_configs(id) ON DELETE SET NULL,
        student_name  VARCHAR(120) NOT NULL,
        student_email VARCHAR(255),
        class_id      INT REFERENCES classes(id) ON DELETE SET NULL,
        score         NUMERIC(6,2) DEFAULT 0,
        max_score     NUMERIC(6,2) DEFAULT 0,
        percentage    NUMERIC(5,2) DEFAULT 0,
        passed        BOOLEAN DEFAULT FALSE,
        started_at    TIMESTAMPTZ DEFAULT NOW(),
        finished_at   TIMESTAMPTZ,
        answers_json  JSONB DEFAULT '[]'
      );`);

    // ── Game sessions ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id              SERIAL PRIMARY KEY,
        competition_id  INT REFERENCES competitions(id) ON DELETE SET NULL,
        team1_name      VARCHAR(60) NOT NULL,
        team2_name      VARCHAR(60) NOT NULL,
        score1          SMALLINT DEFAULT 0,
        score2          SMALLINT DEFAULT 0,
        status          VARCHAR(10) DEFAULT 'playing',
        played_at       TIMESTAMPTZ DEFAULT NOW()
      );`);

    // ── Seed default email config row ─────────────────────
    const { rows: emailRows } = await client.query('SELECT id FROM email_config LIMIT 1');
    if (!emailRows.length) {
      await client.query(`
        INSERT INTO email_config(smtp_host,smtp_port,smtp_user,smtp_pass,smtp_from,prof_email)
        VALUES($1,$2,$3,$4,$5,$6)`,
        [process.env.SMTP_HOST||'', parseInt(process.env.SMTP_PORT)||587,
         process.env.SMTP_USER||'', process.env.SMTP_PASS||'',
         process.env.SMTP_FROM||'', process.env.PROF_EMAIL||'']);
    }

    // ── Seed demo data ────────────────────────────────────
    const { rows: existing } = await client.query('SELECT id FROM competitions LIMIT 1');
    if (!existing.length) {
      const { rows:[c1] } = await client.query(
        `INSERT INTO competitions(name,description) VALUES($1,$2) RETURNING id`,
        ['Mathématiques','Calcul & logique']);
      const { rows:[c2] } = await client.query(
        `INSERT INTO competitions(name,description) VALUES($1,$2) RETURNING id`,
        ['Culture Générale','Connaissances diverses']);

      await client.query(`INSERT INTO classes(name) VALUES('3ème SI'),('4ème SI'),('Terminale')` );

      // QCM questions
      const seedQ = [
        { cid:c1.id, qt:'qcm', t:'7 × 8 = ?', at:'text',
          a:[{text:'54',img:'',is_correct:false,score:0,feedback:'Non, 7×8=56'},{text:'56',img:'',is_correct:true,score:1,feedback:'Bravo !'},{text:'48',img:'',is_correct:false,score:0,feedback:'Non, c\'est 6×8'},{text:'64',img:'',is_correct:false,score:0,feedback:'Non, c\'est 8×8'}],
          ci:1, ms:1 },
        { cid:c1.id, qt:'qcm', t:'√144 = ?', at:'text',
          a:[{text:'11',img:'',is_correct:false,score:0,feedback:''},{text:'12',img:'',is_correct:true,score:1,feedback:'Correct !'},{text:'13',img:'',is_correct:false,score:0,feedback:''},{text:'14',img:'',is_correct:false,score:0,feedback:''}],
          ci:1, ms:1 },
        { cid:c1.id, qt:'truefalse', t:'Le carré de 9 est 81.', at:'text',
          a:[{text:'Vrai',img:'',is_correct:true,score:1,feedback:'Correct ! 9²=81'},{text:'Faux',img:'',is_correct:false,score:0,feedback:'Non, 9²=81'}],
          ci:0, ms:1 },
        { cid:c2.id, qt:'qcm', t:'Capitale de la France ?', at:'text',
          a:[{text:'Lyon',img:'',is_correct:false,score:0,feedback:''},{text:'Marseille',img:'',is_correct:false,score:0,feedback:''},{text:'Paris',img:'',is_correct:true,score:1,feedback:'Oui !'},{text:'Bordeaux',img:'',is_correct:false,score:0,feedback:''}],
          ci:2, ms:1 },
        { cid:c2.id, qt:'order', t:'Remettre dans l\'ordre chronologique :', at:'text',
          a:[{text:'Révolution française',img:'',position:2},{text:'Renaissance',img:'',position:1},{text:'Première Guerre Mondiale',img:'',position:3},{text:'Antiquité grecque',img:'',position:0}],
          ci:0, ms:2 },
        { cid:c2.id, qt:'match', t:'Relier chaque pays à sa capitale :', at:'text',
          a:[{left_text:'France',left_img:'',right_text:'Paris',right_img:''},{left_text:'Espagne',left_img:'',right_text:'Madrid',right_img:''},{left_text:'Italie',left_img:'',right_text:'Rome',right_img:''},{left_text:'Allemagne',left_img:'',right_text:'Berlin',right_img:''}],
          ci:0, ms:2 },
        { cid:c1.id, qt:'fill', t:'Complétez : La somme des angles d\'un triangle est ___ degrés et un carré a ___ côtés.', at:'text',
          a:[{sentence:'La somme des angles d\'un triangle est ___ degrés et un carré a ___ côtés.',blanks:[{word:'180',position:0},{word:'4',position:1}]}],
          ci:0, ms:2 },
      ];
      for (const q of seedQ) {
        await client.query(
          `INSERT INTO questions(competition_id,q_type,text,media_url,ans_type,answers,correct_index,max_score)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [q.cid,q.qt,q.t,'',q.at,JSON.stringify(q.a),q.ci,q.ms]);
      }

      // Demo exam config
      await client.query(
        `INSERT INTO exam_configs(competition_id,name,duration_minutes,shuffle_questions,shuffle_answers,allow_retry,allow_skip,show_feedback,pass_score)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [c1.id,'Examen Maths Demo',20,true,true,false,true,true,60]);

      console.log('✅ Seed data inserted.');
    }

    await client.query('COMMIT');
    console.log('✅ Database schema ready.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ DB init error:', e.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

init().then(() => {
  if (require.main === module) process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
