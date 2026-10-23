import type { Maintainer } from '@unbound-app/contracts/addons';

import { listSubmissionHistory } from '~/lib/admin-submissions';
import type { AdminSubmission } from '~/lib/admin-submissions';
import { MAINTAINERS, toMaintainers } from '~/lib/maintainers';
import type { EventTimeline } from '~/lib/moderation-events';
import { getEventTimeline } from '~/lib/moderation-events';
import type { AdminAddon } from '~/lib/admin-addons';
import { requirePermission } from '~/lib/api/caller';
import type { StaffNote } from '~/lib/staff-notes';
import { listStaffNotes } from '~/lib/staff-notes';
import { hasPermission } from '~/lib/auth/access';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import type { AddonRow } from '~/lib/addons';
import { toAddon } from '~/lib/addons';

export type AdminAddonRecord = AdminAddon &
	Pick<AddonRow, 'type' | 'description'> & {
		/** When the newest version was approved. */
		updatedAt: string;
	};

export type AdminVersion = {
	version: string;
	publishedAt: Date;
	submissionId: string;
	/** The repository its submission proved push access to. */
	repository: string | null;
	/** The manifest's `unbound.min`: the oldest client it supports. */
	minClient: string | null;
	bundleSize: number;
	sha256: string;
};

export type AdminAddonView = {
	addon: AdminAddonRecord;
	/** Owners first. */
	maintainers: Maintainer[];
	/** Every approved version, newest first. */
	versions: AdminVersion[];
	/** Every submission for the addon id, newest first, rejected listings included. */
	submissions: AdminSubmission[];
	/** The newest page of the addon's moderation events. */
	events: EventTimeline;
	/** Staff notes on the addon, newest first; empty without `note:read`. */
	notes: StaffNote[];
};

function queryAddon(ctx: AppContext, id: string) {
	return ctx.db.query.addon.findFirst({
		where: { id },
		with: {
			maintainers: MAINTAINERS,
			versions: {
				columns: {
					version: true,
					publishedAt: true,
					submissionId: true,
					manifest: true,
					bundleSize: true,
					sha256: true,
				},
				with: { submission: { columns: { repository: true } } },
				orderBy: { versionKey: 'desc' },
			},
		},
	});
}

/**
 * @description Loads everything the admin addon page shows: the addon, its maintainers, every
 * version and submission with its review decisions, and its newest moderation events. Requires
 * `addon:delist`.
 * @param ctx The application context.
 * @param caller The moderator.
 * @param id The addon id.
 * @returns The view, or `undefined` when no approved addon has the id.
 */
export async function getAdminAddon(
	ctx: AppContext,
	caller: Caller,
	id: string,
): Promise<AdminAddonView | undefined> {
	requirePermission(caller, { addon: ['delist'] });

	const [row, submissions, events, notes] = await Promise.all([
		queryAddon(ctx, id),
		listSubmissionHistory(ctx, { addonId: id }),
		getEventTimeline(ctx, caller, { type: 'addon', id }),
		hasPermission(caller.user.role, { note: ['read'] })
			? listStaffNotes(ctx, caller, { type: 'addon', id })
			: [],
	]);

	if (!row) return;

	const { maintainers: members, versions, ...rest } = row;
	const maintainers = toMaintainers(members);

	return {
		addon: {
			...toAddon(rest),
			name: rest.name,
			type: rest.type,
			description: rest.description,
			updatedAt: rest.updatedAt.toISOString(),
			latestVersion: versions[0]?.version ?? null,
			owners: maintainers
				.filter((maintainer) => maintainer.role === 'owner')
				.map(({ id: userId, name, image }) => ({ id: userId, name, image })),
		},
		maintainers,
		versions: versions.map(({ manifest, submission, ...version }) => ({
			...version,
			repository: submission?.repository ?? null,
			minClient: manifest.unbound?.min ?? null,
		})),
		submissions,
		events,
		notes,
	};
}

export default { getAdminAddon };
