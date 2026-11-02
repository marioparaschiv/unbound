import type { ValidatorEntry } from './generate';

// The order `validators.gen.ts` exports its checks. Add an entry, run `bun run validators`, then import it.
export const validatorRegistry: ValidatorEntry[] = [];
