import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

/** The filename walked up the directory tree to locate a workspace root. */
export const CONFIG_FILENAME = 'unbound.config.json';

/** A parsed `unbound.config.json` paired with the directory it was found in (or defaulted into). */
export type ResolvedConfig = {
	config: UnboundConfig;
	dir: string;
	/** No config file was found, so `dir` is itself the single addon (the bare-addon shape). */
	bare: boolean;
};

const schema = z.object({
	$schema: z.string().optional(),
	addons: z.array(z.string()).default(['plugins/*', 'themes/*']),
	build: z.string().default('bun run build'),
	output: z.string().default('dist'),
});

/** The validated shape of an `unbound.config.json`. */
export type UnboundConfig = z.infer<typeof schema>;

/**
 * @description Walks up from `cwd` looking for an `unbound.config.json`, parsing the first one found
 * against the config schema. When none exists the `cwd` is treated as a single-addon root carrying
 * the schema defaults, so bare addons need no config.
 * @param cwd The directory to start the upward search from.
 * @returns The parsed config and the directory it resolves relative to.
 */
export function loadConfig(cwd: string = process.cwd()): ResolvedConfig {
	const found = findConfigFile(cwd);

	if (!found) return { config: schema.parse({}), dir: resolve(cwd), bare: true };

	const raw = JSON.parse(readFileSync(found, 'utf8'));
	const config = schema.parse(raw);

	return { config, dir: dirname(found), bare: false };
}

function findConfigFile(from: string): string | undefined {
	let dir = resolve(from);

	while (true) {
		const candidate = resolve(dir, CONFIG_FILENAME);

		if (existsSync(candidate)) return candidate;

		const parent = dirname(dir);
		if (parent === dir) return void 0;

		dir = parent;
	}
}

export default loadConfig;
