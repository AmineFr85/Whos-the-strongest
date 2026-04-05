# 🏆 Who's the Stronger! — Full-Stack Quiz Game

> Node.js + Express + PostgreSQL · Rich media questions · Team Battle

---

## 📁 Structure du projet

```
whos-the-stronger/
├── backend/
│   ├── db/
│   │   ├── pool.js          # Connexion PostgreSQL (pg Pool)
│   │   └── init.js          # Création du schéma + seed data
│   ├── middleware/
│   │   ├── auth.js          # Middleware session admin
│   │   └── upload.js        # Multer (images/vidéos/audio)
│   ├── routes/
│   │   ├── auth.js          # POST /api/auth/login|logout
│   │   ├── competitions.js  # CRUD /api/competitions
│   │   ├── questions.js     # CRUD /api/questions (avec upload)
│   │   └── games.js         # POST /api/games/start|answer|finish
│   └── server.js            # Point d'entrée Express
├── frontend/
│   └── public/
│       ├── index.html       # SPA — toutes les vues
│       ├── css/main.css
│       └── js/
│           ├── api.js       # Client HTTP fetch
│           ├── app.js       # Utilitaires (notify, showScreen…)
│           ├── game.js      # Logique de jeu
│           └── admin.js     # Interface d'administration
├── .env.example
├── package.json
└── README.md
```

---

## ⚙️ Prérequis

- **Node.js** v18+
- **PostgreSQL** v14+

---

## 🚀 Installation

### 1. Cloner et installer les dépendances

```bash
cd whos-the-stronger
npm install
```

### 2. Configurer la base de données

```bash
# Créer la base dans PostgreSQL
psql -U postgres -c "CREATE DATABASE wts_db;"
```

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
# Éditer .env avec vos identifiants PostgreSQL
```

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wts_db
DB_USER=postgres
DB_PASSWORD=votre_mot_de_passe

PORT=3000
SESSION_SECRET=une_cle_secrete_longue_et_aleatoire
ADMIN_PASSWORD=admin123
```

### 4. Initialiser le schéma et les données de démo

```bash
npm run db:init
```

### 5. Lancer le serveur

```bash
# Production
npm start

# Développement (rechargement automatique)
npm run dev
```

### 6. Ouvrir dans le navigateur

```
http://localhost:3000
```

---

## 🗄️ Schéma de la base de données

### `competitions`
| Colonne | Type | Description |
|---------|------|-------------|
| id | SERIAL PK | Identifiant |
| name | VARCHAR(120) | Nom de la compétition |
| description | TEXT | Description optionnelle |
| created_at | TIMESTAMPTZ | Date de création |

### `questions`
| Colonne | Type | Description |
|---------|------|-------------|
| id | SERIAL PK | Identifiant |
| competition_id | INT FK | Compétition associée |
| q_type | VARCHAR(10) | `text` \| `image` \| `video` \| `audio` \| `mixed` |
| text | TEXT | Texte de la question (optionnel) |
| media_url | TEXT | URL ou chemin `/uploads/...` |
| ans_type | VARCHAR(10) | `text` \| `image` \| `mixed` |
| answers | JSONB | `[{text, img}, ...]` — 4 réponses |
| correct_index | SMALLINT | Index de la bonne réponse (0–3) |
| created_at | TIMESTAMPTZ | Date de création |

### `game_sessions`
| Colonne | Type | Description |
|---------|------|-------------|
| id | SERIAL PK | Identifiant |
| competition_id | INT FK | Compétition jouée |
| team1_name | VARCHAR(60) | Nom équipe rouge |
| team2_name | VARCHAR(60) | Nom équipe bleue |
| score1 | SMALLINT | Score équipe rouge |
| score2 | SMALLINT | Score équipe bleue |
| status | VARCHAR(10) | `playing` \| `finished` |
| played_at | TIMESTAMPTZ | Date de la partie |

---

## 🔌 API REST

### Auth
| Méthode | URL | Description |
|---------|-----|-------------|
| POST | `/api/auth/login` | `{ password }` → connexion admin |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/auth/me` | Vérifie si connecté |

### Compétitions (CRUD)
| Méthode | URL | Auth |
|---------|-----|------|
| GET | `/api/competitions` | Public |
| GET | `/api/competitions/:id` | Public |
| POST | `/api/competitions` | Admin |
| PUT | `/api/competitions/:id` | Admin |
| DELETE | `/api/competitions/:id` | Admin |

### Questions (CRUD + upload)
| Méthode | URL | Auth |
|---------|-----|------|
| GET | `/api/questions?competition_id=x` | Public |
| GET | `/api/questions/:id` | Public |
| POST | `/api/questions` | Admin · multipart/form-data |
| PUT | `/api/questions/:id` | Admin · multipart/form-data |
| DELETE | `/api/questions/:id` | Admin |

**Champs multipart pour POST/PUT questions :**
- `q_type`, `text`, `media_url`, `ans_type`, `answers` (JSON string), `correct_index`, `competition_id`
- `media` — fichier média de la question
- `ans_img_0` … `ans_img_3` — images des réponses

### Jeu
| Méthode | URL | Description |
|---------|-----|-------------|
| POST | `/api/games/start` | `{ competition_id, team1_name, team2_name }` → session + questions |
| POST | `/api/games/:id/answer` | `{ question_id, team, choice_index }` → `correct_index` |
| POST | `/api/games/:id/finish` | `{ score1, score2 }` → sauvegarde |
| GET | `/api/games` | Admin · historique |

> **Sécurité :** `correct_index` n'est JAMAIS envoyé au client lors du chargement des questions. Il est renvoyé uniquement via `/answer` après que les deux équipes ont répondu.

---

## 🎮 Fonctionnalités

### Accès Public
- Saisie des noms des deux équipes
- Choix d'une compétition
- Affichage simultané des questions sur deux panneaux
- Overlay "En attente…" tant que l'autre équipe n'a pas répondu
- Révélation synchronisée bonne/mauvaise réponse + popup de round
- Corde animée selon les scores
- Chronomètre 25s par question
- Écran de résultat avec confettis

### Accès Admin (mot de passe dans `.env`)
- **Questions** : Ajouter / Modifier / Supprimer
  - Types : Texte, Image, Vidéo, Audio, Mixte
  - Réponses : Texte, Image ou Mixte
  - Upload de fichiers locaux ou URL externe
- **Compétitions** : Créer / Modifier / Supprimer
- **Historique** : Toutes les parties avec scores et vainqueurs

---

## 🐳 Docker (optionnel)

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: wts_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DB_HOST: db
      DB_NAME: wts_db
      DB_USER: postgres
      DB_PASSWORD: password
      SESSION_SECRET: change_me_in_prod
      ADMIN_PASSWORD: admin123
    depends_on:
      - db
    command: sh -c "node backend/db/init.js && node backend/server.js"

volumes:
  pgdata:
```

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "backend/server.js"]
```

---

## 📝 Notes de déploiement

- En production, définissez `NODE_ENV=production` et utilisez HTTPS
- Les fichiers uploadés sont stockés dans `frontend/public/uploads/`
- Pour une mise à l'échelle, utilisez un stockage objet (S3, Cloudinary) à la place
- Changez `SESSION_SECRET` et `ADMIN_PASSWORD` avant tout déploiement public
