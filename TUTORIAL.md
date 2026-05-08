# 🚀 Tutorial Deploy rpow2 ke Railway via GitHub Codespaces

> Dari nol sampai mining otomatis — tanpa install apapun di laptop

---

## Prasyarat

- Akun GitHub (gratis)
- Akun Railway (gratis) → [railway.app](https://railway.app)
- Repo ini sudah di-fork ke akun GitHub kamu

---

## Bagian 1 — Fork & Buka Codespaces

### Step 1.1 — Fork Repo Ini

1. Buka repo ini di GitHub
2. Klik tombol **Fork** (pojok kanan atas)
3. Pilih akun GitHub kamu → klik **Create fork**

### Step 1.2 — Buka GitHub Codespaces

1. Di repo hasil fork kamu, klik tombol hijau **`<> Code`**
2. Pilih tab **Codespaces**
3. Klik **Create codespace on main**
4. Tunggu ~1-2 menit sampai VS Code di browser terbuka

> ✅ Codespaces sudah include Node.js 22, npm, git — tidak perlu install apapun!

---

## Bagian 2 — Generate Keypair & Session Secret

Di terminal Codespaces (bawah layar), jalankan:

```bash
node setup.mjs
```

Output akan tampil seperti ini:

```
╔═══════════════════════════════════════════════════════════╗
║         rpow2 Railway Environment Variables               ║
╚═══════════════════════════════════════════════════════════╝

RPOW_SIGNING_PRIVATE_KEY_HEX=a1b2c3d4e5f6...
RPOW_SIGNING_PUBLIC_KEY_HEX=9f8e7d6c5b4a...
SESSION_SECRET=0123456789abcdef...
```

> ⚠️ **PENTING:** Copy dan simpan ketiga nilai ini di tempat aman (Notepad, Notes, dll).
> Jika private key hilang, semua token tidak bisa diverifikasi!

---

## Bagian 3 — Setup Railway

### Step 3.1 — Buat Project Baru

1. Buka [railway.app](https://railway.app) → Login
2. Klik **New Project**
3. Pilih **Deploy from GitHub repo**
4. Authorize Railway ke GitHub jika diminta
5. Pilih repo fork rpow2 kamu
6. Railway otomatis detect `railway.toml` → klik **Deploy**

### Step 3.2 — Tambah PostgreSQL

1. Di dalam project Railway, klik **+ New**
2. Pilih **Database** → **Add PostgreSQL**
3. Tunggu database selesai dibuat (~30 detik)
4. `DATABASE_URL` otomatis tersedia — tidak perlu copy manual

### Step 3.3 — Dapat URL Server

1. Klik service utama (bukan PostgreSQL)
2. Buka tab **Settings**
3. Di bagian **Networking** → klik **Generate Domain**
4. Catat URL-nya, contoh: `https://rpow2-production.up.railway.app`

---

## Bagian 4 — Set Environment Variables

1. Di Railway, klik service utama → tab **Variables**
2. Klik **Raw Editor** (lebih mudah copy-paste sekaligus)
3. Paste semua variabel berikut, **ganti nilai yang perlu diganti**:

```
RESEND_API_KEY=re_test
EMAIL_FROM=test@rpow2.local
RPOW_TEST_INBOX=true
DIFFICULTY_BITS=20
DIFFICULTY_FLOOR=8
NODE_ENV=production
PORT=8080
RPOW_EMAIL=emailkamu@gmail.com

SESSION_SECRET=GANTI_DENGAN_HASIL_SETUP_MJS
RPOW_SIGNING_PRIVATE_KEY_HEX=GANTI_DENGAN_HASIL_SETUP_MJS
RPOW_SIGNING_PUBLIC_KEY_HEX=GANTI_DENGAN_HASIL_SETUP_MJS
MAGIC_LINK_BASE_URL=https://GANTI_DENGAN_URL_RAILWAY_KAMU.up.railway.app
WEB_ORIGIN=https://GANTI_DENGAN_URL_RAILWAY_KAMU.up.railway.app
```

4. Klik **Save Changes**

> `DATABASE_URL` tidak perlu diisi — sudah otomatis dari PostgreSQL plugin.

---

## Bagian 5 — Deploy & Verifikasi

### Step 5.1 — Trigger Deploy

Railway otomatis deploy setelah env vars disimpan. Tapi kalau tidak, di tab **Deployments** → klik **Deploy**.

### Step 5.2 — Cek Build Logs

1. Klik deployment yang sedang berjalan
2. Pantau logs — proses build Docker ~3-5 menit
3. Tunggu sampai muncul:
   ```
   [SERVER] ✅ Server ready!
   [MINER] Starting auto-miner...
   ```

### Step 5.3 — Verifikasi Server Jalan

Buka di browser:
```
https://URL-RAILWAY-KAMU.up.railway.app/health
```

Harus muncul response seperti:
```json
{"status":"ok"}
```

---

## Bagian 6 — Cek Mining Berjalan

Di Railway → tab **Logs**, kamu akan lihat:

```
[SERVER] ✅ Server ready!
[MINER] 🔐 Auto-login untuk emailkamu@gmail.com...
[MINER] ✅ Login berhasil!
[MINER] 📋 Request challenge...
[MINER] ⛏️  Mining... difficulty=20 bits
[MINER] ✅ Solution found! nonce=284729 elapsed=7.3s
[MINER] 🎉 Token #1 berhasil di-mint!
[MINER] 📋 Request challenge...
[MINER] ⛏️  Mining... difficulty=20 bits
...
```

Artinya server + miner jalan dalam satu container! Token terus bertambah otomatis.

---

## Bagian 7 — Login ke Web UI (Opsional)

Karena `RPOW_TEST_INBOX=true`, magic link tidak dikirim via email tapi muncul di logs Railway.

1. Buka `https://URL-RAILWAY-KAMU.up.railway.app` di browser
2. Masukkan email kamu → klik **Send Magic Link**
3. Buka Railway → **Logs** → cari baris:
   ```
   magic link: https://URL.up.railway.app/auth/verify?token=xxxxx
   ```
4. Copy URL tersebut → buka di tab baru → kamu login!
5. Buka halaman **Wallet** → lihat token hasil mining

---

## Troubleshooting

### ❌ Build gagal

Pastikan `Dockerfile` ada di root repo (bukan di subfolder). Cek Railway → **Settings** → **Build** → pastikan **Root Directory** kosong (bukan `apps/server`).

### ❌ Server crash saat start

Cek apakah semua env vars sudah diisi. Env vars yang paling sering lupa:
- `SESSION_SECRET` (harus 64 karakter hex)
- `RPOW_SIGNING_PRIVATE_KEY_HEX` (harus 64 karakter hex)
- `MAGIC_LINK_BASE_URL` (harus diawali `https://`)

### ❌ Miner tidak start

Pastikan `RPOW_EMAIL` sudah diset di env vars. Tanpa itu, miner tidak akan jalan.

### ❌ `invalid env` error

Jalankan ulang `node setup.mjs` di Codespaces, pastikan copy nilai yang benar.

### 🔄 Mau reset semua token?

Di Railway → PostgreSQL → **Connect** → jalankan:
```sql
TRUNCATE tokens, challenges, magic_links, users CASCADE;
```

---

## Ringkasan Env Vars

| Variable | Dari mana | Contoh |
|---|---|---|
| `DATABASE_URL` | Auto (Railway PostgreSQL) | — |
| `SESSION_SECRET` | `node setup.mjs` | `a1b2c3...` (64 char) |
| `RPOW_SIGNING_PRIVATE_KEY_HEX` | `node setup.mjs` | `a1b2c3...` (64 char) |
| `RPOW_SIGNING_PUBLIC_KEY_HEX` | `node setup.mjs` | `a1b2c3...` (64 char) |
| `MAGIC_LINK_BASE_URL` | URL Railway kamu | `https://xxx.up.railway.app` |
| `WEB_ORIGIN` | URL Railway kamu | `https://xxx.up.railway.app` |
| `RESEND_API_KEY` | Tetap | `re_test` |
| `EMAIL_FROM` | Tetap | `test@rpow2.local` |
| `RPOW_TEST_INBOX` | Tetap | `true` |
| `RPOW_EMAIL` | Email kamu | `kamu@gmail.com` |
| `DIFFICULTY_BITS` | Tetap | `20` |
| `DIFFICULTY_FLOOR` | Tetap | `8` |
| `NODE_ENV` | Tetap | `production` |
| `PORT` | Tetap | `8080` |

---

*Selamat mining! ⛏️*
