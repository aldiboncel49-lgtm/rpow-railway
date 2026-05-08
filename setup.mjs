#!/usr/bin/env node
/**
 * Setup script — generate Ed25519 keypair untuk Railway deployment
 * Jalankan: node setup.mjs
 */

import { generateKeyPairSync, randomBytes } from 'node:crypto';

function generateKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privRaw = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
  const pubRaw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  return {
    privateHex: privRaw.toString('hex'),
    publicHex: pubRaw.toString('hex'),
  };
}

const keypair = generateKeypair();
const sessionSecret = randomBytes(32).toString('hex');

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║         rpow2 Railway Environment Variables               ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');
console.log('Copy-paste env vars berikut ke Railway Dashboard:\n');
console.log('─────────────────────────────────────────────────────────────');
console.log(`RPOW_SIGNING_PRIVATE_KEY_HEX=${keypair.privateHex}`);
console.log(`RPOW_SIGNING_PUBLIC_KEY_HEX=${keypair.publicHex}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log('─────────────────────────────────────────────────────────────');
console.log('\nEnv vars lain yang perlu diisi manual di Railway:');
console.log('');
console.log('DATABASE_URL=          ← dari Railway PostgreSQL plugin (auto)');
console.log('RESEND_API_KEY=re_test ← pakai ini untuk test mode');
console.log('EMAIL_FROM=test@rpow2.local');
console.log('MAGIC_LINK_BASE_URL=   ← URL server Railway kamu');
console.log('WEB_ORIGIN=            ← URL frontend kamu (atau sama dengan server)');
console.log('RPOW_TEST_INBOX=true   ← aktifkan test inbox');
console.log('DIFFICULTY_BITS=20     ← difficulty mining (lebih kecil = lebih cepat)');
console.log('DIFFICULTY_FLOOR=8     ← minimum difficulty');
console.log('NODE_ENV=production');
console.log('PORT=8080');
console.log('');
console.log('⚠️  SIMPAN private key di atas! Jika hilang, semua token invalid.\n');
