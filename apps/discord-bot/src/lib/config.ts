import type { Env, EnvSource } from '~/lib/env';
import { envSchema } from '~/lib/env';

export type DiscordIds = Record<string, string>;

export type ConfigCheck = { ok: true; env: Env } | { ok: false; message: string };

/**
 * @description Validates the environment and the hardcoded Discord ids together, so one failure names everything to fix.
 * @param source The raw environment.
 * @param ids The id constants from `src/lib/constants.ts`; an id still `'0'` is unset.
 * @returns The parsed environment, or a message listing every unset or invalid value.
 */
export function checkConfig(source: EnvSource, ids: DiscordIds): ConfigCheck {
	const result = envSchema.safeParse(source);
	const problems: string[] = [];

	if (!result.success) {
		for (const issue of result.error.issues) {
			const name = issue.path.join('.');

			problems.push(
				source[name] === undefined
					? `env ${name} is not set`
					: `env ${name}: ${issue.message}`,
			);
		}
	}

	for (const [name, id] of Object.entries(ids)) {
		if (id === '0') {
			problems.push(`constant ${name} in src/lib/constants.ts is not set`);
		}
	}

	if (result.success && !problems.length) {
		return { ok: true, env: result.data };
	}

	return {
		ok: false,
		message: `Refusing to start, the configuration is incomplete:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`,
	};
}

export default { checkConfig };
