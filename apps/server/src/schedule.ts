export const MINT_BASE_BITS = 25;
export const MINT_EPOCH_SIZE = 1_000_000;
export const MINT_MAX_SUPPLY = 21_000_000;

export interface ScheduleOpts {
  baseBits?: number;
  epochSize?: number;
  maxSupply?: number;
}

export interface EpochInfo {
  epoch: number;
  currentBits: number;
  nextMilestoneAt: number;
  coinsToNext: number;
  nextDifficultyBits: number;
  isCapped: boolean;
}

function resolve(opts?: ScheduleOpts) {
  const baseBits = opts?.baseBits ?? MINT_BASE_BITS;
  const epochSize = opts?.epochSize ?? MINT_EPOCH_SIZE;
  const maxSupply = opts?.maxSupply ?? MINT_MAX_SUPPLY;
  // Last legal epoch index. e.g. with epochSize=1M and maxSupply=21M, the last
  // mint legal under cap is the one taking supply from 20,999,999 → 21,000,000,
  // i.e. epoch index 20.
  const maxEpoch = Math.max(0, Math.floor(maxSupply / epochSize) - 1);
  return { baseBits, epochSize, maxSupply, maxEpoch };
}

export function difficultyForSupply(mintedCount: number, opts?: ScheduleOpts): number {
  const { baseBits, epochSize, maxEpoch } = resolve(opts);
  const rawEpoch = Math.floor(Math.max(0, mintedCount) / epochSize);
  const epoch = Math.min(rawEpoch, maxEpoch);
  return baseBits + epoch;
}

export function epochInfo(mintedCount: number, opts?: ScheduleOpts): EpochInfo {
  const { baseBits, epochSize, maxSupply, maxEpoch } = resolve(opts);
  const isCapped = mintedCount >= maxSupply;
  const rawEpoch = Math.floor(Math.max(0, mintedCount) / epochSize);
  const epoch = Math.min(rawEpoch, maxEpoch);
  const currentBits = baseBits + epoch;
  const nextMilestoneAt = isCapped ? maxSupply : Math.min((epoch + 1) * epochSize, maxSupply);
  const coinsToNext = Math.max(0, nextMilestoneAt - mintedCount);
  const nextDifficultyBits = epoch < maxEpoch ? currentBits + 1 : currentBits;
  return { epoch, currentBits, nextMilestoneAt, coinsToNext, nextDifficultyBits, isCapped };
}
