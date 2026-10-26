import type {
	EditAddonRequest,
	FieldChange,
	MaintainerEntry,
	PinnableField,
} from '@unbound-app/contracts/admin';
import type { AddonType, Maintainer } from '@unbound-app/contracts/addons';
import { pinnableFieldSchema } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { asc, desc, eq, inArray } from 'drizzle-orm';

import {
	PINNED_FIELDS,
	getManifestType,
	refreshAddonSummary,
	toAddon,
	writeDelisted,
} from '~/lib/addons';
import { MAINTAINERS, replaceMaintainers, toMaintainers } from '~/lib/maintainers';
import type { ActionMeta, EventTimeline } from '~/lib/moderation-events';
import { appendEvent, getEventTimeline } from '~/lib/moderation-events';
import { listSubmissionHistory } from '~/lib/admin-submissions';
import type { AdminSubmission } from '~/lib/admin-submissions';
import { addon, addonMaintainer, user } from '~/db/schema';
import type { AdminAddon } from '~/lib/admin-addons';
import { requirePermission } from '~/lib/api/caller';
import type { Permissions } from '~/lib/auth/access';
import type { StaffNote } from '~/lib/staff-notes';
import { listStaffNotes } from '~/lib/staff-notes';
import { hasPermission } from '~/lib/auth/access';
import type { Transaction } from '~/db/database';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import type { AddonRow } from '~/lib/addons';
import { ApiError } from '~/lib/api/errors';

export type AdminAddonRecord = AdminAddon &
	Pick<AddonRow, 'type' | 'description' | 'repository'> & {
		/** When the served version was approved. */
		updatedAt: string;
		/** Which summary fields a staff edit owns; the others follow the served version's manifest. */
		pinned: Record<PinnableField, boolean>;
	};

/** What the unpinned summary fields follow: the served version's manifest. */
export type ManifestSummary = {
	name: string;
	description: string;
	type: AddonType;
};

type EditableState = Omit<EditAddonRequest, 'revision' | 'reason'>;

type EditDiff = {
	fields: FieldChange[];
	delisted: boolean;
	maintainers: boolean;
};

/** The rollback that withdrew a version. */
export type Withdrawal = {
	eventId: number;
	at: Date;
	/** `null` once the acting user is deleted. */
	by: UserSummary | null;
	reason: string | null;
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
	/** `null` while it is live. */
	withdrawal: Withdrawal | null;
};

export type AdminAddonView = {
	addon: AdminAddonRecord;
	/** Owners first. */
	maintainers: Maintainer[];
	/** Every approved version, newest first, withdrawn ones included. */
	versions: AdminVersion[];
	/** Every submission for the addon id, newest first, rejected listings included. */
	submissions: AdminSubmission[];
	/** The newest page of the addon's moderation events. */
	events: EventTimeline;
	/** `null` when no version is live. */
	manifest: ManifestSummary | null;
	/** The edit form's starting values, `revision` included. */
	form: EditAddonRequest;
	/** Staff notes on the addon, newest first; empty without `note:read`. */
	notes: StaffNote[];
};

const PINNABLE_FIELDS = pinnableFieldSchema.options;

const GROUP_PERMISSIONS = {
	fields: { addon: ['edit'] },
	delisted: { addon: ['delist'] },
	maintainers: { addon: ['transfer'] },
} as const satisfies Record<keyof EditDiff, Permissions>;

function isPinned(row: AddonRow, field: PinnableField): boolean {
	return Boolean(row.pinnedFields & PINNED_FIELDS[field]);
}

function byUserId(members: MaintainerEntry[]): MaintainerEntry[] {
	return members.toSorted((left, right) => left.userId.localeCompare(right.userId));
}

function toEditableState(row: AddonRow, members: MaintainerEntry[]): EditableState {
	return {
		name: isPinned(row, 'name') ? row.name : null,
		description: isPinned(row, 'description') ? row.description : null,
		type: isPinned(row, 'type') ? row.type : null,
		repository: row.repository,
		delisted: row.delistedAt !== null,
		maintainers: members,
	};
}

function revisionOf(state: EditableState): string {
	const canonical = { ...state, maintainers: byUserId(state.maintainers) };

	return new Bun.CryptoHasher('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function diffEdit(current: EditableState, edit: EditAddonRequest): EditDiff {
	const fields: FieldChange[] = [];

	for (const field of [...PINNABLE_FIELDS, 'repository'] as const) {
		const from = current[field];
		const to = edit[field];

		if (from !== to) {
			fields.push({ field, from, to, pinned: field !== 'repository' && to !== null });
		}
	}

	return {
		fields,
		delisted: current.delisted !== edit.delisted,
		maintainers:
			JSON.stringify(byUserId(current.maintainers)) !==
			JSON.stringify(byUserId(edit.maintainers)),
	};
}

function selectMembers(tx: Transaction, addonId: string): Promise<MaintainerEntry[]> {
	return tx
		.select({ userId: addonMaintainer.userId, role: addonMaintainer.role })
		.from(addonMaintainer)
		.where(eq(addonMaintainer.addonId, addonId))
		.orderBy(desc(addonMaintainer.role), asc(addonMaintainer.createdAt));
}

async function writeFields(tx: Transaction, addonId: string, edit: EditAddonRequest) {
	const { name, description, type, repository } = edit;
	let pinnedFields = 0;

	for (const field of PINNABLE_FIELDS) {
		if (edit[field] !== null) {
			pinnedFields |= PINNED_FIELDS[field];
		}
	}

	await tx
		.update(addon)
		.set({
			pinnedFields,
			repository,
			name: name ?? undefined,
			description: description ?? undefined,
			type: type ?? undefined,
		})
		.where(eq(addon.id, addonId));
	await refreshAddonSummary(tx, addonId);
}

async function requireUsers(tx: Transaction, members: MaintainerEntry[]) {
	const ids = members.map((member) => member.userId);
	const found = await tx.select({ id: user.id }).from(user).where(inArray(user.id, ids));
	const known = new Set(found.map((entry) => entry.id));
	const missing = ids.find((id) => !known.has(id));

	if (missing) {
		throw new ApiError('not_found', `User ${missing} does not exist.`);
	}
}

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
				with: {
					submission: { columns: { repository: true } },
					withdrawal: {
						columns: { id: true, createdAt: true, reason: true },
						with: { actor: { columns: { id: true, name: true, image: true } } },
					},
				},
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
	const served = versions.find((version) => !version.withdrawal);
	const state = toEditableState(
		rest,
		members.map((member) => ({ userId: member.userId, role: member.role })),
	);

	return {
		addon: {
			...toAddon(rest),
			name: rest.name,
			type: rest.type,
			description: rest.description,
			repository: rest.repository,
			updatedAt: rest.updatedAt.toISOString(),
			pinned: {
				name: isPinned(rest, 'name'),
				description: isPinned(rest, 'description'),
				type: isPinned(rest, 'type'),
			},
			latestVersion: served?.version ?? null,
			owners: maintainers
				.filter((maintainer) => maintainer.role === 'owner')
				.map(({ id: userId, name, image }) => ({ id: userId, name, image })),
		},
		maintainers,
		versions: versions.map(({ manifest, submission, withdrawal, ...version }) => ({
			...version,
			repository: submission?.repository ?? null,
			minClient: manifest.unbound?.min ?? null,
			withdrawal: withdrawal
				? {
						eventId: withdrawal.id,
						at: withdrawal.createdAt,
						by: withdrawal.actor
							? { ...withdrawal.actor, image: withdrawal.actor.image ?? null }
							: null,
						reason: withdrawal.reason,
					}
				: null,
		})),
		submissions,
		events,
		manifest: served
			? {
					name: served.manifest.name,
					description: served.manifest.description,
					type: getManifestType(served.manifest),
				}
			: null,
		form: { ...state, revision: revisionOf(state) },
		notes,
	};
}

/**
 * @description Applies what the staff edit form changes, in one transaction; each changed group needs
 * its own permission and records its own event.
 * @param ctx The application context.
 * @param caller The staff member.
 * @param id The addon id.
 * @param edit The whole desired state, with the revision the form loaded.
 * @returns The addon's view after the edit.
 */
export async function editAddon(
	ctx: AppContext,
	caller: Caller,
	id: string,
	edit: EditAddonRequest,
): Promise<AdminAddonView> {
	requirePermission(caller, { addon: ['delist'] });

	await ctx.db.transaction(async (tx) => {
		const [row] = await tx.select().from(addon).where(eq(addon.id, id));

		if (!row) {
			throw new ApiError('not_found', `Addon ${id} does not exist.`);
		}

		const current = toEditableState(row, await selectMembers(tx, id));

		if (revisionOf(current) !== edit.revision) {
			throw new ApiError(
				'edit_conflict',
				`${id} changed since you opened it. Reload to see the changes.`,
			);
		}

		const diff = diffEdit(current, edit);
		const meta: ActionMeta = {
			actorId: caller.user.id,
			at: ctx.now(),
			reason: edit.reason,
		};

		if (diff.fields.length > 0) {
			requirePermission(caller, GROUP_PERMISSIONS.fields);
		}

		if (diff.delisted) {
			requirePermission(caller, GROUP_PERMISSIONS.delisted);
		}

		if (diff.maintainers) {
			requirePermission(caller, GROUP_PERMISSIONS.maintainers);
			await requireUsers(tx, edit.maintainers);
		}

		if (diff.fields.length > 0) {
			await writeFields(tx, id, edit);
			await appendEvent(tx, {
				...meta,
				subject: { type: 'addon', id },
				kind: 'addon.edited',
				data: { changes: diff.fields },
			});
		}

		if (diff.delisted) {
			await writeDelisted(tx, row, edit.delisted, meta);
		}

		if (diff.maintainers) {
			await replaceMaintainers(tx, id, edit.maintainers, meta);
		}
	});

	const view = await getAdminAddon(ctx, caller, id);

	if (!view) {
		throw new Error(`Addon ${id} vanished after its edit.`);
	}

	return view;
}

export default { getAdminAddon, editAddon };
