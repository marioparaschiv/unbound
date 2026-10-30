import type { Env, EnvSource } from '~/lib/env';
import { envSchema } from '~/lib/env';

export type ConfigCheck = { ok: true; env: Env; guildId: string } | { ok: false; message: string };

/**
 * @description Validates the environment and the guild id together, so one failure names everything to fix.
 * @param source The raw environment.
 * @param guildId `GUILD_ID` from `src/lib/constants.ts`; `undefined` means unset.
 * @returns The parsed environment and guild id, or a message listing every unset or invalid value.
 */
export function checkConfig(source: EnvSource, guildId: string | undefined): ConfigCheck {
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

	if (guildId === undefined) {
		problems.push('constant GUILD_ID in src/lib/constants.ts is not set');
	}

	if (result.success && guildId !== undefined && !problems.length) {
		return { ok: true, env: result.data, guildId };
	}

	return {
		ok: false,
		message: `Refusing to start, the configuration is incomplete:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`,
	};
}

export default { checkConfig };
