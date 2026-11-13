import { SKILL_TAXONOMY } from './types';

export { SKILL_TAXONOMY };

export const DEFAULT_WEIGHTS = {
  K: 0.40,
  S: 0.30,
  C: 0.20,
  M: 0.10
} as const;

export const FALLBACK_WEIGHTS = {
  K: 0,
  S: 0.50,
  C: 0.33,
  M: 0.17
} as const;

export const DEFAULT_INTEREST_LEVEL = 3;
export const MAX_SKILL_LEVEL = 5;
export const MAX_INTEREST_LEVEL = 5;
export const WORKLOAD_CAP_MULTIPLIER = 1.25;

export const EMBEDDING_COSINE_MIN = 0.2;
export const EMBEDDING_COSINE_MAX = 0.8;
