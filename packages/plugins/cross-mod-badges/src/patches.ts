import { flux, metro, patcher } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';

import { BADGE_API, toCatalogBadges, toProfileBadges, type ProfileBadge } from '~/lib/badges';

type UserStore = { getCurrentUser(): { id?: string } | undefined };

type BadgeDirectory = {
	getBadges(userId?: string): unknown[] | undefined;
	getBadgeById(badgeId: string, userId?: string): unknown;
};

const badgesByUser = new Map<string, ProfileBadge[] | null>();

async function load(userId: string) {
	badgesByUser.set(userId, null);

	try {
		const response = await fetch(`${BADGE_API}/users/${userId}`);
		const badges = response.ok
			? toProfileBadges(await response.json(), (mod, name) => format('BADGE', { mod, name }))
			: [];

		badgesByUser.set(userId, badges);

		if (!badges.length) return;

		flux.getStore('UserProfile').emitChange();
		flux.getStore('BadgeDirectory')?.emitChange?.();
	} catch (error) {
		logger.warn(`Failed to fetch client mod badges of user ${userId}:`, error);
		badgesByUser.set(userId, []);
	}
}

function badgesFor(userId: string | undefined): ProfileBadge[] {
	if (!userId) return [];

	const badges = badgesByUser.get(userId);

	if (badges === undefined) void load(userId);

	return badges ?? [];
}

function catalogFor(userId: string | undefined) {
	const viewed = userId ?? (flux.getStore('User') as unknown as UserStore).getCurrentUser()?.id;

	return toCatalogBadges(badgesFor(viewed), messages.CATALOG_DESCRIPTION);
}

function patchBadgeDirectory(Store: BadgeDirectory) {
	patcher.after(Store, 'getBadges', ({ args: [userId], result }) => {
		const extra = catalogFor(userId as string | undefined);

		return extra.length ? [...((result as unknown[] | undefined) ?? []), ...extra] : result;
	});
	patcher.after(Store, 'getBadgeById', ({ args: [badgeId, userId], result }) => {
		if (result) return result;

		return catalogFor(userId as string | undefined).find((badge) => badge.badge_id === badgeId);
	});
}

/**
 * @description Adds people's badges from other client mods to their profile's badge row, after Discord's own. Patches
 * `getBadges` on Discord's display profile and on its badge directory, which newer builds draw the row from, once each
 * loads; each user is asked for once per session.
 * @returns A function that stops waiting for the modules.
 */
export function patchProfileBadges(): () => void {
	const stopDirectory = metro.onModuleLoaded(
		metro.filters.byFluxStore('BadgeDirectory'),
		patchBadgeDirectory,
	);
	const stopProfile = metro.onModuleLoaded(
		metro.filters.byPrototypes('getBadges', 'getLegacyUsername'),
		(DisplayProfile) => {
			patcher.after(DisplayProfile.prototype, 'getBadges', ({ this: self, result }) => {
				const extra = badgesFor((self as { userId?: string }).userId);

				return extra.length
					? [...((result as unknown[] | undefined) ?? []), ...extra]
					: result;
			});
		},
	);

	return () => {
		stopDirectory();
		stopProfile();
	};
}

/**
 * @description Forgets every user's badges.
 */
export function forgetBadges(): void {
	badgesByUser.clear();
}
