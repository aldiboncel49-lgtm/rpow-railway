#!/usr/bin/env node
/**
 * rpow2 Auto-Miner Bot
 * Mining otomatis dengan auto-retry jika error
 * Tidak butuh browser — jalan di Node.js murni
 */

import { createHash } from 'node:crypto';

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const CONFIG = {
  SERVER_URL: process.env.RPOW_SERVER_URL || 'http://localhost:8080',
  EMAIL: process.env.RPOW_EMAIL || '',
  SESSION_COOKIE: process.env.RPOW_SESSION_COOKIE || '', // setelah login manual
  RETRY_DELAY_MS: parseInt(process.env.RETRY_DELAY_MS || '5000'),
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '999999'), // hampir unlimited
  MINE_INTERVAL_MS: parseInt(process.env.MINE_INTERVAL_MS || '0'), // 0 = langsung re-mine
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

// ─── LOGGER ─────────────────────────────────────────────────────────────────
function log(level: string, msg: string, data?: unknown) {
  const ts = new Date().toISOString();
  const line = data ? `${msg} ${JSON.stringify(data)}` : msg;
  console.log(`[${ts}] [${level.toUpperCase()}] ${line}`);
}
const info = (msg: string, d?: unknown) => log('info', msg, d);
const warn = (msg: string, d?: unknown) => log('warn', msg, d);
const error = (msg: string, d?: unknown) => log('error', msg, d);
const debug = (msg: string, d?: unknown) => { if (CONFIG.LOG_LEVEL === 'debug') log('debug', msg, d); };

// ─── HELPERS ────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function trailingZeroBits(hash: Uint8Array): number {
  let count = 0;
  for (let i = hash.length - 1; i >= 0; i--) {
    const byte = hash[i]!;
    if (byte === 0) { count += 8; continue; }
    for (let bit = 0; bit < 8; bit++) {
      if ((byte >> bit) & 1) return count;
      count++;
    }
    break;
  }
  return count;
}

// ─── CORE MINING ────────────────────────────────────────────────────────────
function mine(noncePrefix: Buffer, difficultyBits: number): bigint {
  info(`⛏️  Mining... difficulty=${difficultyBits} bits`);
  const buf = Buffer.alloc(noncePrefix.length + 8);
  noncePrefix.copy(buf, 0);

  const startTime = Date.now();
  let nonce = 0n;
  let lastLog = startTime;

  while (true) {
    // Write nonce little-endian
    let x = nonce;
    for (let i = 0; i < 8; i++) {
      buf[noncePrefix.length + i] = Number(x & 0xffn);
      x >>= 8n;
    }

    const hash = createHash('sha256').update(buf).digest();
    if (trailingZeroBits(hash) >= difficultyBits) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      info(`✅ Solution found! nonce=${nonce} elapsed=${elapsed}s hashes=${nonce}`);
      return nonce;
    }

    nonce++;

    // Log progress tiap ~4 detik
    if ((nonce & 0xffffn) === 0n) {
      const now = Date.now();
      if (now - lastLog > 4000) {
        const mh = Number(nonce) / ((now - startTime) / 1000) / 1_000_000;
        debug(`  progress: ${nonce} hashes, ${mh.toFixed(2)} MH/s`);
        lastLog = now;
      }
    }
  }
}

// ─── API CALLS ──────────────────────────────────────────────────────────────
async function apiGet(path: string, cookie: string) {
  const res = await fetch(`${CONFIG.SERVER_URL}${path}`, {
    headers: { Cookie: cookie },
  });
  return res;
}

async function apiPost(path: string, cookie: string, body?: unknown) {
  const res = await fetch(`${CONFIG.SERVER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function getChallenge(cookie: string) {
  const res = await apiPost('/challenge', cookie);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Challenge failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return res.json() as Promise<{
    challenge_id: string;
    nonce_prefix: string;
    difficulty_bits: number;
    expires_at: string;
  }>;
}

async function submitMint(cookie: string, challengeId: string, solutionNonce: bigint) {
  const res = await apiPost('/mint', cookie, {
    challenge_id: challengeId,
    solution_nonce: solutionNonce.toString(),
  });
  const body = await res.json().catch(() => ({})) as any;
  if (!res.ok) {
    throw new Error(`Mint failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function getWallet(cookie: string) {
  const res = await apiGet('/me/tokens', cookie);
  if (!res.ok) throw new Error(`Wallet check failed: ${res.status}`);
  return res.json() as Promise<{ tokens: { id: string; value: number }[] }>;
}

// ─── TEST INBOX — ambil magic link dari server langsung ──────────────────────
async function getTestMagicLink(email: string): Promise<string | null> {
  try {
    const res = await fetch(`${CONFIG.SERVER_URL}/test/last-link/${encodeURIComponent(email)}?json=1`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data?.link || data?.url || null;
  } catch {
    return null;
  }
}

async function requestMagicLink(email: string): Promise<boolean> {
  const res = await apiPost('/auth/request', '', { email });
  if (res.status === 429) {
    const body = await res.json() as any;
    const waitMs = (body.retry_after || 30) * 1000;
    warn(`Rate limited. Tunggu ${body.retry_after}s...`);
    await sleep(waitMs);
    return false;
  }
  return res.ok;
}

async function verifyMagicLink(token: string): Promise<string | null> {
  const url = `${CONFIG.SERVER_URL}/auth/verify?token=${token}`;
  const res = await fetch(url, { redirect: 'manual' });
  // Server set cookie via Set-Cookie header
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  // Extract cookie value
  const match = setCookie.match(/rpow_session=([^;]+)/);
  return match ? `rpow_session=${match[1]}` : null;
}

// ─── AUTO-LOGIN via test inbox ───────────────────────────────────────────────
async function autoLogin(email: string): Promise<string> {
  info(`🔐 Auto-login untuk ${email}...`);

  const ok = await requestMagicLink(email);
  if (!ok) throw new Error('Gagal request magic link');

  // Tunggu email diproses
  await sleep(1000);

  // Coba ambil dari test inbox
  const link = await getTestMagicLink(email);
  if (!link) {
    throw new Error('Test inbox tidak tersedia. Pastikan RPOW_TEST_INBOX=true di server');
  }

  // Extract token dari URL
  const url = new URL(link);
  const token = url.searchParams.get('token');
  if (!token) throw new Error('Token tidak ditemukan di magic link');

  const cookie = await verifyMagicLink(token);
  if (!cookie) throw new Error('Verifikasi magic link gagal');

  info(`✅ Login berhasil! Cookie: ${cookie.substring(0, 30)}...`);
  return cookie;
}

// ─── MINING LOOP ────────────────────────────────────────────────────────────
async function mineLoop(cookie: string) {
  let totalMined = 0;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10;

  info(`🚀 Mulai mining loop...`);

  while (true) {
    try {
      // 1. Ambil challenge
      info(`📋 Request challenge...`);
      const challenge = await getChallenge(cookie);
      info(`📋 Challenge dapat`, {
        id: challenge.challenge_id.substring(0, 8) + '...',
        bits: challenge.difficulty_bits,
        expires: challenge.expires_at,
      });

      // 2. Mine
      const prefix = Buffer.from(challenge.nonce_prefix, 'hex');
      const solution = mine(prefix, challenge.difficulty_bits);

      // 3. Submit
      info(`📤 Submit solution...`);
      const result = await submitMint(cookie, challenge.challenge_id, solution);
      totalMined++;
      consecutiveErrors = 0;

      info(`🎉 Token #${totalMined} berhasil di-mint!`, {
        token_id: result.token?.id?.substring(0, 8) + '...',
        value: result.token?.value,
      });

      // 4. Jeda sebelum mine berikutnya
      if (CONFIG.MINE_INTERVAL_MS > 0) {
        info(`⏳ Jeda ${CONFIG.MINE_INTERVAL_MS / 1000}s sebelum mining berikutnya...`);
        await sleep(CONFIG.MINE_INTERVAL_MS);
      }

    } catch (err: any) {
      consecutiveErrors++;
      const msg = err?.message || String(err);

      if (msg.includes('SUPPLY_EXHAUSTED') || msg.includes('21M cap')) {
        info(`🏁 Supply habis! Total mined: ${totalMined}`);
        break;
      }

      if (msg.includes('UNAUTHORIZED') || msg.includes('login required')) {
        error(`🔒 Session expired! Perlu login ulang`);
        throw new Error('SESSION_EXPIRED');
      }

      error(`❌ Error #${consecutiveErrors}: ${msg}`);

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        error(`💀 Terlalu banyak error berturut-turut (${consecutiveErrors}). Restart session...`);
        throw new Error('TOO_MANY_ERRORS');
      }

      const delay = Math.min(CONFIG.RETRY_DELAY_MS * consecutiveErrors, 60000);
      warn(`🔄 Retry dalam ${delay / 1000}s...`);
      await sleep(delay);
    }
  }

  return totalMined;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  info('═══════════════════════════════════════');
  info('  rpow2 Auto-Miner Bot');
  info(`  Server: ${CONFIG.SERVER_URL}`);
  info(`  Email:  ${CONFIG.EMAIL || '(dari SESSION_COOKIE)'}`);
  info('═══════════════════════════════════════');

  let cookie = CONFIG.SESSION_COOKIE;
  let retries = 0;

  while (retries < CONFIG.MAX_RETRIES) {
    try {
      // Login jika belum ada cookie
      if (!cookie) {
        if (!CONFIG.EMAIL) {
          error('Set RPOW_EMAIL atau RPOW_SESSION_COOKIE di env');
          process.exit(1);
        }
        cookie = await autoLogin(CONFIG.EMAIL);
      }

      // Mulai mining
      await mineLoop(cookie);
      break; // supply exhausted, keluar normal

    } catch (err: any) {
      const msg = err?.message || String(err);
      retries++;

      if (msg === 'SESSION_EXPIRED' || msg === 'TOO_MANY_ERRORS') {
        warn(`🔄 Session reset. Percobaan ${retries}/${CONFIG.MAX_RETRIES}`);
        cookie = ''; // reset cookie, login ulang
        await sleep(CONFIG.RETRY_DELAY_MS);
      } else {
        error(`Fatal error: ${msg}`);
        const delay = Math.min(CONFIG.RETRY_DELAY_MS * retries, 120000);
        warn(`🔄 Restart dalam ${delay / 1000}s... (${retries}/${CONFIG.MAX_RETRIES})`);
        await sleep(delay);
      }
    }
  }

  info('🏁 Miner selesai.');
}

main().catch(err => {
  error('Uncaught error', err);
  process.exit(1);
});
