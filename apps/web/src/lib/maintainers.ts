import type {
	Maintainer,
	MaintainersResponse,
	TransferAddonRequest,
} from '@unbound-app/contracts/addons';
import type { MaintainerEntry } from '@unbound-app/contracts/admin';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import type { ActionMeta } from '~/lib/moderation-events';
import { appendEvent } from '~/lib/moderation-events';
import { requirePermission } from '~/lib/api/caller';
import type { Transaction } from '~/db/database';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { addonMaintainer } from '~/db/schema';
import { ApiError } from '~/lib/api/errors';

type MaintainerRow = Pick<typeof addonMaintainer.$inferSelect, 'role' | 'createdAt'> & {
	user: Pick<Maintainer, 'id' | 'name' | 'image'> | null;
};

/** The relational query options that load maintainers, owners first, with their user. */
export const MAINTAINERS = {
	with: { user: { columns: { id: true, name: true, image: true } } },
	orderBy: { role: 'desc', createdAt: 'asc' },
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
		.orderBy(desc(addonMaintainer.role), asc(addonMaintainer.createdAt));
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

async function requireUser(ctx: AppContext, userId: string) {
	const target = await ctx.db.query.user.findFirst({
		where: { id: userId },
		columns: { id: true },
	});

	if (!target) {
		throw new ApiError('not_found', `User ${userId} does not exist.`);
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
	await requireUser(ctx, userId);

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
	await requireUser(ctx, request.userId);

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

export default {
	MAINTAINERS,
	toMaintainers,
	replaceMaintainers,
	listMaintainers,
	addMaintainer,
	removeMaintainer,
	transferAddon,
};
