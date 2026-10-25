import type {
	BotActor,
	BotAddon,
	BotEvent,
	BotMember,
	BotRelease,
} from '@unbound-app/contracts/bot';

export {
	botAddonsResponseSchema,
	botEventsResponseSchema,
	botMembersResponseSchema,
	botReleasesResponseSchema,
} from '@unbound-app/contracts/bot';
export type { LoaderPlatform } from '@unbound-app/contracts/loader';
export type { AddonType } from '@unbound-app/contracts/addons';

export type FeedName = 'addons' | 'events' | 'releases' | 'members';

export type FeedPage<T> = {
	items: T[];
	cursor: string | null;
	hasMore: boolean;
};

export type AddonFeedItem = BotAddon;
export type EventActor = BotActor;
export type EventFeedItem = BotEvent;
export type ReleaseFeedItem = BotRelease;
/** `discordId` is `null` once the user unlinks Discord or is deleted. */
export type MemberFeedItem = BotMember;

export type FeedItems = {
	addons: AddonFeedItem;
	events: EventFeedItem;
	releases: ReleaseFeedItem;
	members: MemberFeedItem;
};
