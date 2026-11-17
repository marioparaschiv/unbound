import { and, countDistinct, desc, eq, gte, isNotNull } from 'drizzle-orm';
import type { CrashReport } from '@unbound-app/contracts/crash-reports';
import { createLogger } from '@unbound-app/logger';

import { addonVersion, crashReport } from '~/db/schema';
import { appendEvent } from '~/lib/moderation-events';
import { refreshAddonSummary } from '~/lib/addons';
import type { AppContext } from '~/lib/context';

const logger = createLogger('CrashWithdrawal');

export const CRASH_SPIKE_INSTALLS = 5;
export const CRASH_SPIKE_WINDOW_MS = 60 * 60_000;

type VersionRow = { version: string; withdrawnBy: number | null };

export type CrashWithdrawalPlan = { from: string; to: string };

/**
 * @description Plans withdrawing a crashing version: it must still be live, and another live version must be left to serve.
 * @param versions The addon's versions, newest first.
 * @param crashing The version that crashes.
 * @returns The versions served before and after, or `undefined` when nothing should change.
 */
export function planCrashWithdrawal(
	versions: VersionRow[],
	crashing: string,
): CrashWithdrawalPlan | undefined {
	const live = versions.filter(({ withdrawnBy }) => withdrawnBy === null);
	const fallback = live.find(({ version }) => version !== crashing);

	if (!live.some(({ version }) => version === crashing) || !fallback || !live[0]) {
		return undefined;
	}

	return {
		from: live[0].version,
		to: live[0].version === crashing ? fallback.version : live[0].version,
	};
}

async function crashingInstalls(
	ctx: AppContext,
	addonId: string,
	version: string,
): Promise<number> {
	const [row] = await ctx.db
		.select({ installs: countDistinct(crashReport.installId) })
		.from(crashReport)
		.where(
			and(
				eq(crashReport.addonId, addonId),
				eq(crashReport.addonVersion, version),
				isNotNull(crashReport.installId),
				gte(crashReport.receivedAt, new Date(ctx.now().getTime() - CRASH_SPIKE_WINDOW_MS)),
			),
		);

	return row?.installs ?? 0;
}

/**
 * @description Withdraws an addon version once enough separate installs report it crashing within an hour, so every
 * client turns it off, falling back to the newest other live version. Logged as an `addon.rollback` event without an actor.
 * @param ctx The application context.
 * @param report The crash report just stored.
 * @returns Whether the version was withdrawn.
 */
export async function withdrawOnCrashSpike(ctx: AppContext, report: CrashReport): Promise<boolean> {
	const addon = report.addon;

	if (!addon || !report.installId) {
		return false;
	}

	try {
		const installs = await crashingInstalls(ctx, addon.id, addon.version);

		if (installs < CRASH_SPIKE_INSTALLS) {
			return false;
		}

		return await ctx.db.transaction(async (tx) => {
			const versions = await tx
				.select({ version: addonVersion.version, withdrawnBy: addonVersion.withdrawnBy })
				.from(addonVersion)
				.where(eq(addonVersion.addonId, addon.id))
				.orderBy(desc(addonVersion.versionKey));
			const plan = planCrashWithdrawal(versions, addon.version);

			if (!plan) {
				return false;
			}

			const eventId = await appendEvent(tx, {
				subject: { type: 'addon', id: addon.id },
				actorId: null,
				at: ctx.now(),
				reason: `Withdrawn automatically: ${installs} installs crashed on ${addon.version} within an hour.`,
				kind: 'addon.rollback',
				data: { ...plan, withdrawn: [addon.version], restored: [] },
			});

			await tx
				.update(addonVersion)
				.set({ withdrawnBy: eventId })
				.where(
					and(
						eq(addonVersion.addonId, addon.id),
						eq(addonVersion.version, addon.version),
					),
				);
			await refreshAddonSummary(tx, addon.id);

			return true;
		});
	} catch (error) {
		logger.error(`Failed to check crash spike for ${addon.id} ${addon.version}:`, error);

		return false;
	}
}
