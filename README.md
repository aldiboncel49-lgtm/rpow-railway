# rpow2 — Railway Deployment

> Fork dari [frkrueger/rpow](https://github.com/frkrueger/rpow) dengan konfigurasi Railway + Auto-Miner Bot

## 🗂️ Struktur Repo

```
rpow-railway/
├── apps/
│   ├── server/          # Backend API (Fastify + Node.js)
│   └── web/             # Frontend (Vite + React)
├── packages/
│   └── shared/          # Shared types & utils
├── miner-bot/
│   ├── miner.ts         # Auto-miner bot (Node.js)
│   ├── Dockerfile       # Deploy miner di Railway
│   └── package.json
├── railway.toml         # Config deploy server ke Railway
├── setup.mjs            # Generate keypair & env vars
└── README.md
```

---

## 🚀 Deploy ke Railway (Step by Step)

### Step 1 — Generate Keypair

Jalankan di terminal lokal (butuh Node 22):

```bash
node setup.mjs
```

Simpan output-nya! Berisi private key, public key, dan session secret.

---

### Step 2 — Buat Project di Railway

1. Buka [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Pilih repo ini
4. Railway akan otomatis detect `railway.toml`

---

### Step 3 — Tambah PostgreSQL

Di dalam project Railway:
1. Klik **+ New** → **Database** → **Add PostgreSQL**
2. `DATABASE_URL` akan otomatis tersedia sebagai env var

---

### Step 4 — Set Environment Variables

Di Railway Dashboard → **Variables**, tambahkan:

| Variable | Value |
|---|---|
| `DATABASE_URL` | *(auto dari PostgreSQL plugin)* |
| `RESEND_API_KEY` | `re_test` |
| `EMAIL_FROM` | `test@rpow2.local` |
| `SESSION_SECRET` | *(dari setup.mjs)* |
| `MAGIC_LINK_BASE_URL` | `https://xxx.up.railway.app` *(URL server kamu)* |
| `WEB_ORIGIN` | `https://xxx.up.railway.app` *(sama atau URL frontend)* |
| `RPOW_SIGNING_PRIVATE_KEY_HEX` | *(dari setup.mjs)* |
| `RPOW_SIGNING_PUBLIC_KEY_HEX` | *(dari setup.mjs)* |
| `RPOW_TEST_INBOX` | `true` |
| `DIFFICULTY_BITS` | `20` |
| `DIFFICULTY_FLOOR` | `8` |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |

---

### Step 5 — Deploy!

Railway akan otomatis build dan deploy via Dockerfile.

Cek health: `https://xxx.up.railway.app/health`

---

## ⛏️ Auto-Miner Bot

### Deploy Miner di Railway (Service Terpisah)

1. Di project yang sama → **+ New** → **GitHub Repo**
2. Set **Root Directory** ke `miner-bot`
3. Tambahkan env vars:

| Variable | Value |
|---|---|
| `RPOW_SERVER_URL` | URL server Railway kamu |
| `RPOW_EMAIL` | email kamu untuk mining |
| `RETRY_DELAY_MS` | `5000` |
| `MINE_INTERVAL_MS` | `0` (langsung re-mine) |
| `LOG_LEVEL` | `info` |

### Cara Kerja Auto-Miner

```
1. Login otomatis via test inbox (ambil magic link dari server)
2. Request challenge dari server
3. Mining SHA-256 hashcash sampai ketemu solusi
4. Submit solusi → token masuk ke wallet
5. Ulangi dari step 2
6. Jika error → retry otomatis dengan exponential backoff
7. Jika session expired → login ulang otomatis
```

### Jalankan Lokal

```bash
# Set env vars
export RPOW_SERVER_URL=http://localhost:8080
export RPOW_EMAIL=kamu@example.com
export LOG_LEVEL=debug

# Jalankan
cd miner-bot
node --experimental-strip-types miner.ts
```

---

## 🔐 Login Manual (Tanpa Auto-Miner)

Karena `RPOW_TEST_INBOX=true`, magic link tidak dikirim via email tapi tersimpan di server.

1. Buka `https://xxx.up.railway.app` di browser
2. Masukkan email → klik "Send Magic Link"
3. Di Railway logs, cari: `magic link: http://...`
4. Copy URL tersebut → buka di browser → login!

---

## ⚠️ Catatan Penting

- **Private key wajib disimpan** — jika hilang, semua token tidak bisa diverifikasi
- `re_test` mode = email tidak benar-benar dikirim, hanya test
- Miner bot butuh server dalam kondisi running
- `DIFFICULTY_BITS=20` → ~5-10 detik per token di server Railway
- Supply maksimal tetap 21.000.000 token (hardcoded di kode)
