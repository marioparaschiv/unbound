import { createContributorCache } from '~/lib/github-contributors';
import { createAuditDispatcher } from '~/dispatchers/audit';
import { releasesDispatcher } from '~/dispatchers/releases';
import { createRolesDispatcher } from '~/dispatchers/roles';
import type { AuditTelemetry } from '~/lib/audit-telemetry';
import { addonsDispatcher } from '~/dispatchers/addons';
import type { Dispatcher } from '~/dispatchers/types';
import type { Env } from '~/lib/env';

export type DispatcherConfig = {
	env: Env;
	/** The validated `GUILD_ID`. */
	guildId: string;
	telemetry: AuditTelemetry;
};

/**
 * @description Builds every dispatcher from the validated configuration; each track adds one entry here.
 * @param config The validated environment, guild id and the audit telemetry.
 * @returns The dispatchers the runtime starts.
 */
export function createDispatchers({ env, guildId, telemetry }: DispatcherConfig): Dispatcher[] {
	return [
		addonsDispatcher,
		releasesDispatcher,
		createAuditDispatcher(telemetry),
		createRolesDispatcher({
			guildId,
			contributors: createContributorCache({ token: env.GITHUB_TOKEN }),
		}),
	];
}

export default { createDispatchers };
