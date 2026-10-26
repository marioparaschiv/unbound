import type { AddonType } from '@unbound-app/contracts/addons';

import type { loaderRelease, moderationEvent } from '~/db/schema';

/** A manifest author as an addon post shows it; `discordId` is the manifest's author id. */
export type PublicAddonAuthor = {
	name: string;
	discordId?: string;
};

/** An addon's public listing as it is now; the old feed's addon minus `updatedAt`, so its hash matches. */
export type PublicAddon = {
	id: string;
	type: AddonType;
	name: string;
	description: string;
	/** The newest live version's version. */
	version: string;
	authors: PublicAddonAuthor[];
	/** Only an http(s) manifest icon. */
	iconUrl?: string;
	/** `<siteUrl>/addons/<id>`. */
	pageUrl: string;
	/** `false` once staff delist it. */
	listed: boolean;
};

export type AuditActor = {
	id: string;
	name: string;
};

type ModerationEventRow = typeof moderationEvent.$inferSelect;

/** One moderation log entry as stored; `data` is not re-validated, the bot renders unknown shapes raw. */
export type AuditEvent = Pick<
	ModerationEventRow,
	'id' | 'kind' | 'subjectType' | 'subjectId' | 'data' | 'reason' | 'createdAt'
> & {
	/** The addon or user name while the subject exists. */
	subjectName: string | null;
	/** `null` for system actions and once the acting user is deleted. */
	actor: AuditActor | null;
};

export type Release = Pick<
	typeof loaderRelease.$inferSelect,
	'platform' | 'version' | 'url' | 'changelog' | 'publishedAt'
>;

export type ReleaseKey = Pick<Release, 'platform' | 'version'>;

/** A user with a linked Discord account; users without one are never returned. */
export type Member = {
	userId: string;
	discordId: string;
	githubId: string | null;
	/** Maintains a listed addon that has a live version. */
	isAddonDeveloper: boolean;
	/** The linked GitHub account's sponsorship is active or in grace now. */
	isSponsor: boolean;
};

/** What a member lookup is keyed by; every one but `discord` is also a `member_changed` payload prefix. */
export type MemberSubject = 'user' | 'discord' | 'github' | 'addon';

export type MemberQuery = { by: 'all' } | { by: MemberSubject; ids: readonly string[] };

export type BotReadOptions = {
	/** The site origin addon page urls are built on, e.g. `https://unbound.rip`. */
	siteUrl: string;
	/** Days sponsor perks outlast a sponsorship, as the web's `SPONSOR_PERK_GRACE_DAYS`. */
	sponsorGraceDays: number;
	/** The clock sponsor standing is judged at. */
	now?: () => Date;
};

/** The web's data as the Discord bot sees it. Every method is one read; none writes. */
export type BotReads = {
	/** The addon as listed now; `undefined` when it is gone or serves no version. */
	addon: (id: string) => Promise<PublicAddon | undefined>;
	/** Every addon that serves a version, delisted ones included. */
	addons: () => Promise<PublicAddon[]>;
	/** Moderation events after an id, oldest first. */
	eventsAfter: (afterId: number, limit: number) => Promise<AuditEvent[]>;
	/** A published release; `undefined` once withdrawn. */
	release: (key: ReleaseKey) => Promise<Release | undefined>;
	/** Releases published at or after a moment, in publish order. */
	releasesSince: (since: Date) => Promise<Release[]>;
	/** The Discord-linked users a query names. */
	members: (query: MemberQuery) => Promise<Member[]>;
};
