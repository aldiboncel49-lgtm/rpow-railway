import { describe, it, expect } from 'vitest';
import { verifySolution, findSolutionForTest } from '../src/pow.js';

describe('verifySolution', () => {
  it('accepts a valid 8-bit-trailing-zero solution', () => {
    const prefix = Buffer.from('deadbeef', 'hex');
    const nonce = findSolutionForTest(prefix, 8);
    expect(verifySolution(prefix, nonce, 8)).toBe(true);
  });
  it('rejects an off-by-one prefix', () => {
    const prefix = Buffer.from('deadbeef', 'hex');
    const nonce = findSolutionForTest(prefix, 8);
    expect(verifySolution(Buffer.from('deadbef0', 'hex'), nonce, 8)).toBe(false);
  });
});
