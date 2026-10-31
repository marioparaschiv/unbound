import type {
	Maintainer,
	MaintainersResponse,
	TransferAddonRequest,
} from '@unbound-app/contracts/addons';
import type { MaintainerChange } from '@unbound-app/contracts/review';
import type { MaintainerEntry } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import type { ActionMeta } from '~/lib/moderation-events';
import { appendEvent } from '~/lib/moderation-events';
import { requirePermission } from '~/lib/api/caller';
import type { Transaction } from '~/db/database';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { addonMaintainer, user } from '~/db/schema';
import { ApiError } from '~/lib/api/errors';

type MaintainerRow = Pick<typeof addonMaintainer.$inferSelect, 'role' | 'createdAt'> & {
	user: Pick<Maintainer, 'id' | 'name' | 'image'> | null;
};

/** An addon's maintainers as a submission sees them: who owns it, who else maintains it, and whether the author may change that. */
export type SubmissionMaintainers = {
	/** The owners, whom the maintainers a submission names never include. */
	ownerIds: string[];
	/** The maintainers other than the owners, which a submission's set replaces. */
	current: UserSummary[];
	/** The author owns the addon, or the new listing will make them its owner. */
	editable: boolean;
};

/** A pending submission that names maintainers, as the review queue reads it. */
type NamedMaintainers = {
	id: string;
	addonId: string;
	maintainers: string[];
};

/** The relational query options that load maintainers, owners first, with their user. */
export const MAINTAINERS = {
	with: { user: { columns: { id: true, name: true, image: true } } },
	orderBy: { role: 'desc', createdAt: 'asc', userId: 'asc' },
} as const;

/**
 * @description Serializes maintainer rows for the API, dropping any whose user is gone.
 * @param rows The rows loaded with {@link MAINTAINERS}.
 * @returns The maintainers.
 */
export function toMaintainers(rows: MaintainerRow[]): Maintainer[] {
	return rows.flatMap((row) =>
		row.user
			? [
					{
						id: row.user.id,
						name: row.user.name,
						image: row.user.image ?? null,
						role: row.role,
						addedAt: row.createdAt.toISOString(),
					},
				]
			: [],
	);
}

function selectMembers(tx: Transaction, addonId: string): Promise<MaintainerEntry[]> {
	return tx
		.select({ userId: addonMaintainer.userId, role: addonMaintainer.role })
		.from(addonMaintainer)
		.where(eq(addonMaintainer.addonId, addonId))
		.orderBy(
			desc(addonMaintainer.role),
			asc(addonMaintainer.createdAt),
			asc(addonMaintainer.userId),
		);
}

/**
 * @description The one writer of an addon's maintainers: makes the member list exactly `next`,
 * keeping each remaining member's join date, and records `addon.maintainers_changed` when anything
 * changed.
 * @param tx The action's transaction.
 * @param addonId The addon id.
 * @param next Every member after the change, each user once.
 * @param meta Who made the change, when and why.
 * @returns Resolves once the members are replaced.
 */
export async function replaceMaintainers(
	tx: Transaction,
	addonId: string,
	next: MaintainerEntry[],
	meta: ActionMeta,
): Promise<void> {
	if (!next.some((member) => member.role === 'owner')) {
		throw new ApiError(
			'last_owner',
			`${addonId} needs another owner before its only owner can leave.`,
		);
	}

	const before = await selectMembers(tx, addonId);
	const roles = new Map(before.map((member) => [member.userId, member.role]));
	const kept = new Set(next.map((member) => member.userId));
	const removed = before
		.filter((member) => !kept.has(member.userId))
		.map((member) => member.userId);
	const changed = next.filter((member) => roles.get(member.userId) !== member.role);

	if (removed.length === 0 && changed.length === 0) return;

	if (removed.length > 0) {
		await tx
			.delete(addonMaintainer)
			.where(
				and(eq(addonMaintainer.addonId, addonId), inArray(addonMaintainer.userId, removed)),
			);
	}

	for (const member of changed) {
		await tx
			.insert(addonMaintainer)
			.values({ addonId, ...member, createdAt: meta.at })
			.onConflictDoUpdate({
				target: [addonMaintainer.addonId, addonMaintainer.userId],
				set: { role: member.role },
			});
	}

	await appendEvent(tx, {
		...meta,
		subject: { type: 'addon', id: addonId },
		kind: 'addon.maintainers_changed',
		data: { before, after: await selectMembers(tx, addonId) },
	});
}

async function requireAddon(ctx: AppContext, id: string) {
	const row = await ctx.db.query.addon.findFirst({ where: { id }, columns: { id: true } });

	if (!row) {
		throw new ApiError('not_found', `Addon ${id} does not exist.`);
	}
}

function toSummary({ id, name, image }: UserSummary): UserSummary {
	return { id, name, image };
}

async function readUsers(db: Pick<Transaction, 'select'>, ids: string[]): Promise<UserSummary[]> {
	if (ids.length === 0) return [];

	const rows = await db
		.select({ id: user.id, name: user.name, image: user.image })
		.from(user)
		.where(inArray(user.id, ids));

	return rows.map((row) => ({ ...row, image: row.image ?? null }));
}

// The one check of who can become a maintainer, shared by the maintainers dialog and submissions.
async function requireUsers(ctx: AppContext, ids: string[]) {
	const known = new Set((await readUsers(ctx.db, ids)).map((row) => row.id));
	const unknown = ids.find((id) => !known.has(id));

	if (unknown) {
		throw new ApiError('not_found', `User ${unknown} does not exist.`);
	}
}

async function requireOwner(ctx: AppContext, caller: Caller, addonId: string) {
	const membership = await ctx.db.query.addonMaintainer.findFirst({
		where: { addonId, userId: caller.user.id },
		columns: { role: true },
	});

	if (!membership) {
		await requireAddon(ctx, addonId);

		throw new ApiError('not_maintainer', `You are not a maintainer of ${addonId}.`);
	}

	if (membership.role !== 'owner') {
		throw new ApiError('forbidden', `Only owners of ${addonId} can manage its maintainers.`);
	}
}

/**
 * @description Lists the addon's maintainers, owners first.
 * @param ctx The application context.
 * @param addonId The addon id.
 * @returns The maintainers.
 */
export async function listMaintainers(
	ctx: AppContext,
	addonId: string,
): Promise<MaintainersResponse> {
	const rows = await ctx.db.query.addonMaintainer.findMany({
		where: { addonId },
		...MAINTAINERS,
	});

	return { maintainers: toMaintainers(rows) };
}

/**
 * @description Adds a user as a maintainer of an addon the caller owns. Adding an existing member
 * changes nothing.
 * @param ctx The application context.
 * @param caller An owner of the addon.
 * @param addonId The addon id.
 * @param userId The user to add.
 * @returns The maintainers after the change.
 */
export async function addMaintainer(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	userId: string,
): Promise<MaintainersResponse> {
	await requireOwner(ctx, caller, addonId);
	await requireUsers(ctx, [userId]);

	await ctx.db.transaction(async (tx) => {
		const members = await selectMembers(tx, addonId);
		const next: MaintainerEntry[] = members.some((member) => member.userId === userId)
			? members
			: [...members, { userId, role: 'maintainer' }];

		await replaceMaintainers(tx, addonId, next, { actorId: caller.user.id, at: ctx.now() });
	});

	return listMaintainers(ctx, addonId);
}

/**
 * @description Removes a maintainer from an addon the caller owns. An owner can only be removed while
 * another owner remains.
 * @param ctx The application context.
 * @param caller An owner of the addon.
 * @param addonId The addon id.
 * @param userId The member to remove.
 * @returns The maintainers after the change.
 */
export async function removeMaintainer(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	userId: string,
): Promise<MaintainersResponse> {
	await requireOwner(ctx, caller, addonId);

	await ctx.db.transaction(async (tx) => {
		const members = await selectMembers(tx, addonId);

		if (!members.some((member) => member.userId === userId)) {
			throw new ApiError('not_found', `${userId} is not a maintainer of ${addonId}.`);
		}

		await replaceMaintainers(
			tx,
			addonId,
			members.filter((member) => member.userId !== userId),
			{ actorId: caller.user.id, at: ctx.now() },
		);
	});

	return listMaintainers(ctx, addonId);
}

/**
 * @description Makes another user the addon's owner. The previous owner stays on as a maintainer
 * unless `keepPreviousOwner` is false. Requires `addon:transfer`.
 * @param ctx The application context.
 * @param caller The administrator.
 * @param addonId The addon id.
 * @param request The new owner and whether to keep the previous one.
 * @returns The maintainers after the transfer.
 */
export async function transferAddon(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
	request: TransferAddonRequest,
): Promise<MaintainersResponse> {
	requirePermission(caller, { addon: ['transfer'] });

	await requireAddon(ctx, addonId);
	await requireUsers(ctx, [request.userId]);

	await ctx.db.transaction(async (tx) => {
		const members = await selectMembers(tx, addonId);
		const others = members.flatMap((member): MaintainerEntry[] => {
			if (member.userId === request.userId) {
				return [];
			}

			if (member.role !== 'owner') {
				return [member];
			}

			return request.keepPreviousOwner ? [{ ...member, role: 'maintainer' }] : [];
		});

		await replaceMaintainers(
			tx,
			addonId,
			[{ userId: request.userId, role: 'owner' }, ...others],
			{ actorId: caller.user.id, at: ctx.now() },
		);
	});

	return listMaintainers(ctx, addonId);
}

/**
 * @description Reads the maintainers a submission of the addon would replace, and whether its author may.
 * @param ctx The application context.
 * @param caller The submission's author.
 * @param addonId The submitted addon id.
 * @returns The owners and other maintainers; an addon without any is a new listing the author will own.
 */
export async function readSubmissionMaintainers(
	ctx: AppContext,
	caller: Caller,
	addonId: string,
): Promise<SubmissionMaintainers> {
	const rows = await ctx.db.query.addonMaintainer.findMany({
		where: { addonId },
		...MAINTAINERS,
	});
	const members = toMaintainers(rows);

	if (members.length === 0) {
		return { ownerIds: [caller.user.id], current: [], editable: true };
	}

	const ownerIds = members.filter((member) => member.role === 'owner').map((member) => member.id);

	return {
		ownerIds,
		current: members.filter((member) => member.role !== 'owner').map(toSummary),
		editable: ownerIds.includes(caller.user.id),
	};
}

/**
 * @description Checks the maintainers a submission names: only an owner may name them, never an
 * owner, and each must be a user.
 * @param ctx The application context.
 * @param addonId The submitted addon id.
 * @param access The addon's maintainers, from {@link readSubmissionMaintainers}.
 * @param ids The named user ids.
 * @returns Resolves when the set is allowed.
 */
export async function requireSubmissionMaintainers(
	ctx: AppContext,
	addonId: string,
	access: SubmissionMaintainers,
	ids: string[],
): Promise<void> {
	if (!access.editable) {
		throw new ApiError('forbidden', `Only owners of ${addonId} can change its maintainers.`);
	}

	const owner = ids.find((id) => access.ownerIds.includes(id));

	if (owner) {
		throw new ApiError(
			'invalid_request',
			`User ${owner} owns ${addonId}, so it cannot also be a maintainer.`,
		);
	}

	await requireUsers(ctx, ids);
}

/**
 * @description Gives an addon the maintainers an approved submission names, keeping its owners. Changes
 * nothing once the author no longer owns the addon, and skips users deleted since.
 * @param tx The approval's transaction.
 * @param addonId The addon id.
 * @param ids The maintainers besides the owners.
 * @param meta The submission's author, who chose them, and the approval time.
 * @returns Resolves once the maintainers are replaced.
 */
export async function applySubmissionMaintainers(
	tx: Transaction,
	addonId: string,
	ids: string[],
	meta: ActionMeta,
): Promise<void> {
	const members = await selectMembers(tx, addonId);
	const owners = members.filter((member) => member.role === 'owner');

	if (!owners.some((member) => member.userId === meta.actorId)) return;

	const ownerIds = new Set(owners.map((member) => member.userId));
	const users = await readUsers(tx, ids);
	const added = users
		.filter((entry) => !ownerIds.has(entry.id))
		.map((entry): MaintainerEntry => ({ userId: entry.id, role: 'maintainer' }));

	await replaceMaintainers(tx, addonId, [...owners, ...added], meta);
}

/**
 * @description Shows reviewers how approving each submission would change its addon's maintainers.
 * @param ctx The application context.
 * @param submissions The pending submissions that name maintainers.
 * @returns Each submission's added and removed maintainers, by submission id.
 */
export async function describeMaintainerChanges(
	ctx: AppContext,
	submissions: NamedMaintainers[],
): Promise<Map<string, MaintainerChange>> {
	if (submissions.length === 0) return new Map();

	const [rows, named] = await Promise.all([
		ctx.db.query.addonMaintainer.findMany({
			where: {
				addonId: { in: submissions.map((entry) => entry.addonId) },
				role: 'maintainer',
			},
			columns: { addonId: true },
			with: { user: { columns: { id: true, name: true, image: true } } },
		}),
		readUsers(ctx.db, [...new Set(submissions.flatMap((entry) => entry.maintainers))]),
	]);

	return new Map(
		submissions.map((entry) => {
			const current = rows.flatMap((row) =>
				row.addonId === entry.addonId && row.user
					? [{ ...row.user, image: row.user.image ?? null }]
					: [],
			);
			const kept = new Set(entry.maintainers);
			const before = new Set(current.map((member) => member.id));

			return [
				entry.id,
				{
					added: named.filter((member) => kept.has(member.id) && !before.has(member.id)),
					removed: current.filter((member) => !kept.has(member.id)),
				},
			];
		}),
	);
}

export default {
	MAINTAINERS,
	toMaintainers,
	replaceMaintainers,
	listMaintainers,
	addMaintainer,
	removeMaintainer,
	transferAddon,
	readSubmissionMaintainers,
	requireSubmissionMaintainers,
	applySubmissionMaintainers,
	describeMaintainerChanges,
};
