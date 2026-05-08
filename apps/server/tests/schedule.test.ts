import { describe, it, expect } from 'vitest';
import { difficultyForSupply, epochInfo } from '../src/schedule.js';

describe('difficultyForSupply (production defaults: base=25, epoch=1M, max=21M)', () => {
  it('returns base bits at supply 0', () => {
    expect(difficultyForSupply(0)).toBe(25);
  });
  it('returns base bits just below first milestone', () => {
    expect(difficultyForSupply(999_999)).toBe(25);
  });
  it('bumps +1 bit at first milestone', () => {
    expect(difficultyForSupply(1_000_000)).toBe(26);
  });
  it('bumps to 27 in mid-epoch 2', () => {
    expect(difficultyForSupply(2_500_000)).toBe(27);
  });
  it('reaches 45 bits at last legal epoch', () => {
    expect(difficultyForSupply(20_999_999)).toBe(45);
  });
  it('clamps difficulty at maxEpoch even past cap', () => {
    expect(difficultyForSupply(21_000_000)).toBe(45);
    expect(difficultyForSupply(50_000_000)).toBe(45);
  });
});

describe('difficultyForSupply with test overrides', () => {
  const opts = { baseBits: 4, epochSize: 10, maxSupply: 21 };
  it('starts at baseBits', () => {
    expect(difficultyForSupply(0, opts)).toBe(4);
  });
  it('bumps at epochSize', () => {
    expect(difficultyForSupply(10, opts)).toBe(5);
  });
  it('clamps at maxEpoch (= maxSupply/epochSize - 1)', () => {
    // maxEpoch = floor(21/10) - 1 = 1, so bits = 4 + 1 = 5 once past first milestone
    expect(difficultyForSupply(15, opts)).toBe(5);
    expect(difficultyForSupply(20, opts)).toBe(5);
    expect(difficultyForSupply(21, opts)).toBe(5);
  });
});

describe('epochInfo', () => {
  it('reports progress mid-epoch with production defaults', () => {
    expect(epochInfo(500_000)).toEqual({
      epoch: 0,
      currentBits: 25,
      nextMilestoneAt: 1_000_000,
      coinsToNext: 500_000,
      nextDifficultyBits: 26,
      isCapped: false,
    });
  });
  it('reports the first boundary as the start of epoch 1', () => {
    expect(epochInfo(1_000_000)).toEqual({
      epoch: 1,
      currentBits: 26,
      nextMilestoneAt: 2_000_000,
      coinsToNext: 1_000_000,
      nextDifficultyBits: 27,
      isCapped: false,
    });
  });
  it('marks isCapped at maxSupply', () => {
    const info = epochInfo(21_000_000);
    expect(info.isCapped).toBe(true);
    expect(info.coinsToNext).toBe(0);
  });
  it('marks isCapped past maxSupply', () => {
    expect(epochInfo(99_999_999).isCapped).toBe(true);
  });
});
