// Swap point: replace these with `@unbound-app/contracts/bot` once packages/contracts/src/bot.ts lands.

export type FeedName = 'addons' | 'events' | 'releases' | 'members';

export type FeedPage<T> = {
	items: T[];
	cursor: string | null;
	hasMore: boolean;
};

// Mirrors `addonTypeSchema` (`ADDON_TYPES` in @unbound-app/types/addons).
export type AddonType = 'plugin' | 'theme' | 'icon-pack' | 'font';

export type AddonAuthor = {
	name: string;
	githubLogin?: string;
	discordId?: string;
};

export type AddonFeedItem = {
	id: string;
	type: AddonType;
	name: string;
	description: string;
	version: string;
	authors: AddonAuthor[];
	iconUrl?: string;
	pageUrl: string;
	listed: boolean;
	updatedAt: string;
};

export type EventActor = {
	id: string;
	name: string;
};

export type EventFeedItem = {
	id: number;
	kind: string;
	subjectType: string;
	subjectId: string;
	subjectName?: string;
	actor: EventActor | null;
	// UNKNOWN: the event data is per-kind JSON the bot stores verbatim.
	data: unknown;
	reason: string | null;
	createdAt: string;
};

export type LoaderPlatform = 'ios' | 'android';

export type ReleaseFeedItem = {
	platform: LoaderPlatform;
	version: string;
	url: string;
	changelog: string | null;
	publishedAt: string;
};

export type MemberFeedItem = {
	userId: string;
	discordId: string;
	githubId?: string;
	githubLogin?: string;
	isAddonDeveloper: boolean;
	isSponsor: boolean;
	updatedAt: string;
};

export type FeedItems = {
	addons: AddonFeedItem;
	events: EventFeedItem;
	releases: ReleaseFeedItem;
	members: MemberFeedItem;
};
