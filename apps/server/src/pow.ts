import { createHash } from 'node:crypto';
import { trailingZeroBits } from '@rpow/shared';

export function verifySolution(noncePrefix: Buffer, solutionNonce: bigint, difficultyBits: number): boolean {
  const nonceBuf = Buffer.alloc(8);
  let x = solutionNonce;
  for (let i = 0; i < 8; i++) { nonceBuf[i] = Number(x & 0xffn); x >>= 8n; }
  const h = createHash('sha256').update(noncePrefix).update(nonceBuf).digest();
  return trailingZeroBits(h) >= difficultyBits;
}

/** Test helper: brute-force a small solution. */
export function findSolutionForTest(prefix: Buffer, bits: number): bigint {
  for (let i = 0n; i < 1_000_000n; i++) {
    if (verifySolution(prefix, i, bits)) return i;
  }
  throw new Error(`no solution within bound for ${bits} bits`);
}
