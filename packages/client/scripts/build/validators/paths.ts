import { fileURLToPath } from 'node:url';

/** The committed module the registry generates; client code imports the checks from here. */
export const GENERATED_PATH = fileURLToPath(
	new URL('../../../src/core/validators.gen.ts', import.meta.url).href,
);
