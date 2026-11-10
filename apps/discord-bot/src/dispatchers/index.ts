import { reviewNoticesDispatcher } from '~/dispatchers/review-notices';
import { createContributorCache } from '~/lib/github-contributors';
import { createAuditDispatcher } from '~/dispatchers/audit';
import { releasesDispatcher } from '~/dispatchers/releases';
import { createRolesDispatcher } from '~/dispatchers/roles';
import type { AuditTelemetry } from '~/lib/audit-telemetry';
import { addonsDispatcher } from '~/dispatchers/addons';
import type { Dispatcher } from '~/dispatchers/types';
import type { BotConfig } from '~/lib/config';

export type DispatcherConfig = {
	config: BotConfig;
	telemetry: AuditTelemetry;
};

/**
 * @description Builds every dispatcher from the validated configuration; each track adds one entry here.
 * @param options The bot's configuration and the audit telemetry.
 * @returns The dispatchers the runtime starts.
 */
export function createDispatchers({ config, telemetry }: DispatcherConfig): Dispatcher[] {
	return [
		addonsDispatcher,
		releasesDispatcher,
		createAuditDispatcher(telemetry),
		reviewNoticesDispatcher,
		createRolesDispatcher({
			guildId: config.guildId,
			contributors: createContributorCache({ token: config.env.GITHUB_TOKEN }),
		}),
	];
}

export default { createDispatchers };
