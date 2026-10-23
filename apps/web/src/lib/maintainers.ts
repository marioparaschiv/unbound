import type {
	Maintainer,
	MaintainersResponse,
	TransferAddonRequest,
} from '@unbound-app/contracts/addons';
import { and, eq, ne } from 'drizzle-orm';

import { requirePermission } from '~/lib/api/caller';
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

	await ctx.db
		.insert(addonMaintainer)
		.values({ addonId, userId, role: 'maintainer', createdAt: ctx.now() })
		.onConflictDoNothing();

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

	ctx.db.transaction(
		(tx) => {
			const members = tx
				.select({ userId: addonMaintainer.userId, role: addonMaintainer.role })
				.from(addonMaintainer)
				.where(eq(addonMaintainer.addonId, addonId))
				.all();

			const target = members.find((member) => member.userId === userId);

			if (!target) {
				throw new ApiError('not_found', `${userId} is not a maintainer of ${addonId}.`);
			}

			const owners = members.filter((member) => member.role === 'owner');

			if (target.role === 'owner' && owners.length <= 1) {
				throw new ApiError(
					'last_owner',
					`${addonId} needs another owner before its only owner can leave.`,
				);
			}

			tx.delete(addonMaintainer)
				.where(
					and(eq(addonMaintainer.addonId, addonId), eq(addonMaintainer.userId, userId)),
				)
				.run();
		},
		{ behavior: 'immediate' },
	);

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

	const previous = and(
		eq(addonMaintainer.addonId, addonId),
		eq(addonMaintainer.role, 'owner'),
		ne(addonMaintainer.userId, request.userId),
	);

	ctx.db.transaction(
		(tx) => {
			if (request.keepPreviousOwner) {
				tx.update(addonMaintainer).set({ role: 'maintainer' }).where(previous).run();
			} else {
				tx.delete(addonMaintainer).where(previous).run();
			}

			tx.insert(addonMaintainer)
				.values({ addonId, userId: request.userId, role: 'owner', createdAt: ctx.now() })
				.onConflictDoUpdate({
					target: [addonMaintainer.addonId, addonMaintainer.userId],
					set: { role: 'owner' },
				})
				.run();
		},
		{ behavior: 'immediate' },
	);

	return listMaintainers(ctx, addonId);
}

export default {
	MAINTAINERS,
	toMaintainers,
	listMaintainers,
	addMaintainer,
	removeMaintainer,
	transferAddon,
};
