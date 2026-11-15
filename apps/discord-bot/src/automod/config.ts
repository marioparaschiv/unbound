import type { Punishment, Rate } from '~/lib/automod-rules';

/** One automod rule's punishments, applied in order. */
type Punishes = { punishments: readonly Punishment[] };

/** Automod's settings, mirroring Carl-bot's as the server had them; a zero rate or an empty list turns a rule off. */
export type AutomodConfig = {
	/** Channels and categories automod ignores. */
	allowedChannelIds: readonly string[];
	/** Roles automod ignores; members who can manage the server are always ignored. */
	allowedRoleIds: readonly string[];
	/** A message in one of these channels is punished, whatever it says. */
	honeypot: Punishes & { channelIds: readonly string[] };
	/** Invites to other servers; invites to this one are allowed. */
	invites: Punishes & { enabled: boolean };
	badWords: Punishes & { words: readonly string[] };
	links: Punishes & { blacklist: readonly string[] };
	/** Mentions of users and roles across a member's messages. */
	mentions: Punishes & { rate: Rate };
	/** Capital letters in one message. */
	caps: Punishes & { limit: number };
	/** Files across a member's messages. */
	attachments: Punishes & { rate: Rate; purgeDays: number };
	/** Messages a member sends. */
	spam: Punishes & { rate: Rate };
	/** Active warnings that earn a punishment. */
	warnThreshold: Punishes & { count: number };
};

/** Carl-bot's automod dashboard for the server, as it stood when the bot replaced it. */
export const AUTOMOD: AutomodConfig = {
	allowedChannelIds: [],
	allowedRoleIds: [],
	honeypot: { channelIds: [], punishments: [] },
	invites: { enabled: true, punishments: ['delete'] },
	badWords: { words: [], punishments: ['delete', 'dm'] },
	links: { blacklist: [], punishments: ['delete'] },
	mentions: { rate: { count: 0, seconds: 0 }, punishments: ['mute'] },
	caps: { limit: 0, punishments: ['delete'] },
	attachments: { rate: { count: 0, seconds: 0 }, purgeDays: 1, punishments: ['ban'] },
	spam: { rate: { count: 0, seconds: 0 }, punishments: ['delete'] },
	warnThreshold: { count: 0, punishments: [] },
};

export default { AUTOMOD };
