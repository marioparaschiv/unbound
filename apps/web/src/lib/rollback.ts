import type { ServeVersionRequest } from '@unbound-app/contracts/admin';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { appendEvent } from '~/lib/moderation-events';
import { requirePermission } from '~/lib/api/caller';
import { refreshAddonSummary } from '~/lib/addons';
import { addon, addonVersion } from '~/db/schema';
import type { Transaction } from '~/db/database';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { planServe } from '~/lib/serve-plan';
import { ApiError } from '~/lib/api/errors';

export type ServeVersionResult = {
	served: string;
	/** The version served before; equal to `served` when nothing changed. */
	previous: string | null;
	/** Newest first. */
	withdrawn: string[];
	/** Newest first. */
	restored: string[];
	/** The `addon.rollback` event, or `null` when the version was already served. */
	eventId: number | null;
};

function setWithdrawnBy(
	tx: Transaction,
	addonId: string,
	versions: string[],
	withdrawnBy: number | null,
) {
	if (versions.length === 0) return;

	tx.update(addonVersion)
		.set({ withdrawnBy })
		.where(and(eq(addonVersion.addonId, addonId), inArray(addonVersion.version, versions)))
		.run();
}

/**
 * @description Makes `version` the one the addon serves to the catalog, listings, its public page and
 * update checks. Every live version above it is withdrawn and tagged with this rollback. A withdrawn
 * target comes back with every lower version its rollback withdrew, so serving the pre-rollback version
 * undoes it. Serving the served version writes nothing. No version or artifact is ever deleted.
 * Requires `addon:rollback`.
 * @param ctx The application context.
 * @param caller The administrator.
 * @param addonId The addon id.
 * @param request The version to serve and why.
 * @returns What was served before and after, and which versions changed.
 */
export function serveVersion(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	request: ServeVersionRequest,
): ServeVersionResult {
	requirePermission(caller, { addon: ['rollback'] });

	return ctx.db.transaction(
		(tx) => {
			const versions = tx
				.select({ version: addonVersion.version, withdrawnBy: addonVersion.withdrawnBy })
				.from(addonVersion)
				.where(eq(addonVersion.addonId, addonId))
				.orderBy(desc(addonVersion.versionKey))
				.all();
			const plan = planServe(versions, request.version);

			if (!plan) {
				const exists = tx
					.select({ id: addon.id })
					.from(addon)
					.where(eq(addon.id, addonId))
					.get();

				throw new ApiError(
					'not_found',
					exists
						? `${addonId} has no approved version ${request.version}.`
						: `Addon ${addonId} does not exist.`,
				);
			}

			const { previous, withdrawn, restored } = plan;
			const result = { served: request.version, previous, withdrawn, restored };

			if (withdrawn.length === 0 && restored.length === 0) {
				return { ...result, eventId: null };
			}

			const eventId = appendEvent(tx, {
				subject: { type: 'addon', id: addonId },
				actorId: caller.user.id,
				at: ctx.now(),
				reason: request.reason,
				kind: 'addon.rollback',
				data: { from: previous, to: request.version, withdrawn, restored },
			});

			setWithdrawnBy(tx, addonId, withdrawn, eventId);
			setWithdrawnBy(tx, addonId, restored, null);
			refreshAddonSummary(tx, addonId);

			return { ...result, eventId };
		},
		{ behavior: 'immediate' },
	);
}

export default { serveVersion };
