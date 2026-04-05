// backend/db/init.js  –  Run once: node backend/db/init.js
require('dotenv').config();
const pool = require('./pool');

async function init() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Competitions ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS competitions (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(120) NOT NULL,
        description TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Questions ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id              SERIAL PRIMARY KEY,
        competition_id  INT REFERENCES competitions(id) ON DELETE SET NULL,
        q_type          VARCHAR(10) NOT NULL DEFAULT 'text',  -- text|image|video|audio|mixed
        text            TEXT,
        media_url       TEXT,
        ans_type        VARCHAR(10) NOT NULL DEFAULT 'text',  -- text|image|mixed
        answers         JSONB NOT NULL,   -- [{text, img}, ...]  length = 4
        correct_index   SMALLINT NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Game sessions ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id              SERIAL PRIMARY KEY,
        competition_id  INT REFERENCES competitions(id) ON DELETE SET NULL,
        team1_name      VARCHAR(60) NOT NULL,
        team2_name      VARCHAR(60) NOT NULL,
        score1          SMALLINT DEFAULT 0,
        score2          SMALLINT DEFAULT 0,
        status          VARCHAR(10) DEFAULT 'playing',  -- playing|finished
        played_at       TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Seed data ──────────────────────────────────────────
    const { rows: existing } = await client.query('SELECT id FROM competitions LIMIT 1');
    if (existing.length === 0) {
      const { rows: [c1] } = await client.query(
        `INSERT INTO competitions(name,description) VALUES($1,$2) RETURNING id`,
        ['Mathématiques', 'Calcul & logique']
      );
      const { rows: [c2] } = await client.query(
        `INSERT INTO competitions(name,description) VALUES($1,$2) RETURNING id`,
        ['Culture Générale', 'Connaissances diverses']
      );

      const seedQ = [
        { cid: c1.id, qt:'text', t:'7 × 8 = ?', m:'', at:'text',
          a:[{text:'54',img:''},{text:'56',img:''},{text:'48',img:''},{text:'64',img:''}], ci:1 },
        { cid: c1.id, qt:'text', t:'√144 = ?', m:'', at:'text',
          a:[{text:'11',img:''},{text:'12',img:''},{text:'13',img:''},{text:'14',img:''}], ci:1 },
        { cid: c1.id, qt:'text', t:'2³ + 3² = ?', m:'', at:'text',
          a:[{text:'15',img:''},{text:'17',img:''},{text:'19',img:''},{text:'21',img:''}], ci:1 },
        { cid: c1.id, qt:'text', t:'PGCD(48, 36) = ?', m:'', at:'text',
          a:[{text:'6',img:''},{text:'12',img:''},{text:'18',img:''},{text:'24',img:''}], ci:1 },
        { cid: c2.id, qt:'text', t:'Capitale de la France ?', m:'', at:'text',
          a:[{text:'Lyon',img:''},{text:'Marseille',img:''},{text:'Paris',img:''},{text:'Bordeaux',img:''}], ci:2 },
        { cid: c2.id, qt:'text', t:'Combien de planètes dans le Système Solaire ?', m:'', at:'text',
          a:[{text:'7',img:''},{text:'8',img:''},{text:'9',img:''},{text:'10',img:''}], ci:1 },
        { cid: c2.id, qt:'text', t:'Auteur de "Les Misérables" ?', m:'', at:'text',
          a:[{text:'Zola',img:''},{text:'Hugo',img:''},{text:'Balzac',img:''},{text:'Flaubert',img:''}], ci:1 },
      ];

      for (const q of seedQ) {
        await client.query(
          `INSERT INTO questions(competition_id,q_type,text,media_url,ans_type,answers,correct_index)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [q.cid, q.qt, q.t, q.m, q.at, JSON.stringify(q.a), q.ci]
        );
      }
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
    await pool.end();
  }
}

init();
