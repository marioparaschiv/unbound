import { createLogger } from '@unbound-app/logger';

import {
	isSponsorBadgeId,
	toSponsorBadges,
	type SponsorBadges,
} from '~/builtins/sponsor-badge-shapes';
import { byFluxStore, byProps, byPrototypes } from '~/metro/filters';
import { findByProps, findStore } from '~/metro/lookups';
import { createPatcher } from '~/patcher/create-patcher';
import { createUnboundClient } from '~/account/client';
import { onModuleLoaded } from '~/metro/wait';
import { Screens } from '~/core/constants';
import { Users } from '~/metro/stores';
import { messages } from '~/i18n/api';

const Patcher = createPatcher('unbound::sponsor-badges');
const Logger = createLogger('SponsorBadges');

const UserProfiles = findStore('UserProfile');
const BadgeDirectoryScreen = findByProps('closeBadgeDirectoryScreen');
const UserSettings = findByProps('openUserSettings');

// `null` while a user's badges load, so each user is asked for once per session.
const badgesByUser = new Map<string, SponsorBadges | null>();
const stopWaiting: (() => void)[] = [];
// Unset until Discord loads the badge directory store.
let BadgeDirectory: MetroExport;

/**
 * @description Shows each user's Unbound sponsor badges on their Discord profile, in Discord's own badge row,
 * badge directory and badge details sheet. Each patch lands when Discord loads the module it patches.
 */
export function start() {
	stopWaiting.push(
		onModuleLoaded(byPrototypes('getBadges', 'getLegacyUsername'), patchDisplayProfile),
		onModuleLoaded(byFluxStore('BadgeDirectory'), patchBadgeDirectory),
		onModuleLoaded(byProps('getBadgeDetailsCta'), patchBadgeDetailsCta),
		onModuleLoaded(byProps('shouldShowLegacyUnavailableNotice'), patchBadgeDetails),
	);
}

function patchDisplayProfile(DisplayProfile: MetroExport) {
	Patcher.after(DisplayProfile.prototype, 'getBadges', ({ this: self, result }) => {
		const badges = badgesFor(self.userId);

		// First, because the profile row shows only the first few badges.
		return badges.profile.length ? [...badges.profile, ...(result ?? [])] : result;
	});
}

function patchBadgeDirectory(Store: MetroExport) {
	BadgeDirectory = Store;

	// Both default to the current user when no user id is given.
	Patcher.after(Store, 'getBadges', ({ args: [userId], result }) => {
		const badges = badgesFor(userId ?? Users.getCurrentUser()?.id);

		return badges.catalog.length ? [...badges.catalog, ...(result ?? [])] : result;
	});

	Patcher.after(Store, 'getBadgeById', ({ args: [badgeId, userId], result }) => {
		const badges = badgesFor(userId ?? Users.getCurrentUser()?.id);

		return result ?? badges.catalog.find((badge) => badge.badge_id === badgeId);
	});
}

// The badge details sheet shows this as its button, which it presses after closing itself.
const GET_YOUR_OWN_CTA = {
	ctaLabel: () => messages.UNBOUND_SPONSOR_BADGE_CTA,
	ctaAction() {
		BadgeDirectoryScreen.closeBadgeDirectoryScreen();
		UserSettings.openUserSettings({ screen: Screens.General });
	},
};

function patchBadgeDetailsCta(Ctas: MetroExport) {
	// Only viewers without a badge of their own are asked to sponsor, so it shows on other people's badges.
	Patcher.after(Ctas, 'getBadgeDetailsCta', ({ args: [badgeId], result }) => {
		if (!isSponsorBadgeId(badgeId)) {
			return result;
		}

		const own = badgesFor(Users.getCurrentUser()?.id);

		return own.profile.length ? result : GET_YOUR_OWN_CTA;
	});
}

function patchBadgeDetails(Details: MetroExport) {
	// Discord calls any badge nobody can earn that the viewer lacks retired; a sponsor badge is not.
	Patcher.after(Details, 'shouldShowLegacyUnavailableNotice', ({ args: [options], result }) =>
		isSponsorBadgeId(options?.badge?.badge_id) ? false : result,
	);
}

const NO_BADGES: SponsorBadges = { profile: [], catalog: [] };

function badgesFor(userId: string | undefined): SponsorBadges {
	if (!userId) {
		return NO_BADGES;
	}

	const badges = badgesByUser.get(userId);

	if (badges === undefined) {
		void load(userId);
	}

	return badges ?? NO_BADGES;
}

async function load(userId: string) {
	badgesByUser.set(userId, null);

	try {
		const request = createUnboundClient();
		const { badges } = await request('GET /api/v1/users/$id/badges', {
			params: { id: userId },
		});

		badgesByUser.set(userId, toSponsorBadges(badges, messages.UNBOUND_SPONSOR_BADGE_DESC));

		if (badges.length === 0) return;

		// Discord re-reads a profile's badges when either store changes.
		UserProfiles.emitChange();
		BadgeDirectory?.emitChange();
	} catch (error) {
		Logger.error(`Failed to fetch sponsor badges of user ${userId}:`, error);
		badgesByUser.set(userId, NO_BADGES);
	}
}

/** Stops waiting for Discord's profile modules, removes the badges and forgets every user's badges. */
export function stop() {
	for (const stop of stopWaiting.splice(0)) {
		stop();
	}

	Patcher.unpatchAll();
	BadgeDirectory = undefined;
	badgesByUser.clear();
}

export default { start, stop };
