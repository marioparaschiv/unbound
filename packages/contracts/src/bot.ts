import { moderationEventDataSchema, subjectTypeSchema } from './admin';
import { loaderReleaseSchema } from './loader';
import { addonTypeSchema } from './addons';
import { semverSchema } from './manifest';
import { z } from './zod';

export const BOT_FEED_DEFAULT_LIMIT = 100;

export const BOT_FEED_MAX_LIMIT = 500;

/** A query-string page size: a whole number from 1 to {@link BOT_FEED_MAX_LIMIT}. */
export const botFeedLimitSchema = z.pipe(
	z.string().check(z.regex(/^\d+$/, 'Pass the limit as a whole number.')),
	z.pipe(
		z.transform((value: string) => Number(value)),
		z.int().check(z.minimum(1), z.maximum(BOT_FEED_MAX_LIMIT)),
	),
);

/** Every bot feed reads from `after`, the previous page's `cursor`; omitted, from the start. */
export const botFeedQuerySchema = z.optional(
	z.object({
		after: z.optional(z.string().check(z.maxLength(512))),
		/** Defaults to {@link BOT_FEED_DEFAULT_LIMIT}. */
		limit: z.optional(botFeedLimitSchema),
	}),
);

/** A manifest author; `discordId` is the manifest's author id. */
export const botAddonAuthorSchema = z.object({
	name: z.string(),
	githubLogin: z.optional(z.string()),
	discordId: z.optional(z.string()),
});

/** An addon's public listing as it is now; it reappears in the feed whenever the listing changes. */
export const botAddonSchema = z.object({
	id: z.string(),
	type: addonTypeSchema,
	name: z.string(),
	description: z.string(),
	/** The version the addon serves. */
	version: semverSchema,
	authors: z.array(botAddonAuthorSchema),
	iconUrl: z.optional(z.url({ protocol: /^https?$/ })),
	pageUrl: z.url(),
	/** `false` once staff delist it. */
	listed: z.boolean(),
	/** When the listing last changed. */
	updatedAt: z.iso.datetime(),
});

/** A user's Discord roles inputs as they are now. */
export const botMemberSchema = z.object({
	userId: z.string(),
	/** `null` once the user unlinks Discord or is deleted; both flags are then `false`. */
	discordId: z.nullable(z.string()),
	githubId: z.optional(z.string()),
	githubLogin: z.optional(z.string()),
	/** Maintains at least one listed addon. */
	isAddonDeveloper: z.boolean(),
	/** Their linked GitHub account sponsors the project, grace period included. */
	isSponsor: z.boolean(),
	/** When an input last changed. */
	updatedAt: z.iso.datetime(),
});

/** A published native loader release; withdrawn releases drop out of the feed. */
export const botReleaseSchema = loaderReleaseSchema;

export const botActorSchema = z.object({ id: z.string(), name: z.string() });

/** One moderation log entry, oldest first. */
export const botEventSchema = z.intersection(
	moderationEventDataSchema,
	z.object({
		id: z.int(),
		subjectType: subjectTypeSchema,
		subjectId: z.string(),
		/** The addon or user name, while the subject exists. */
		subjectName: z.optional(z.string()),
		/** `null` for system actions and once the acting user is deleted. */
		actor: z.nullable(botActorSchema),
		reason: z.nullable(z.string()),
		createdAt: z.iso.datetime(),
	}),
);

function botPageSchema<T extends z.ZodMiniType>(item: T) {
	return z.object({
		items: z.array(item),
		/** Pass as `after` for the next page; `null` only when nothing has been read yet. */
		cursor: z.nullable(z.string()),
		/** Whether more rows wait past `cursor` right now. */
		hasMore: z.boolean(),
	});
}

export const botAddonsResponseSchema = botPageSchema(botAddonSchema);

export const botMembersResponseSchema = botPageSchema(botMemberSchema);

export const botReleasesResponseSchema = botPageSchema(botReleaseSchema);

export const botEventsResponseSchema = botPageSchema(botEventSchema);

export type BotFeedQuery = z.infer<typeof botFeedQuerySchema>;
export type BotAddonAuthor = z.infer<typeof botAddonAuthorSchema>;
export type BotAddon = z.infer<typeof botAddonSchema>;
export type BotMember = z.infer<typeof botMemberSchema>;
export type BotRelease = z.infer<typeof botReleaseSchema>;
export type BotActor = z.infer<typeof botActorSchema>;
export type BotEvent = z.infer<typeof botEventSchema>;
export type BotAddonsResponse = z.infer<typeof botAddonsResponseSchema>;
export type BotMembersResponse = z.infer<typeof botMembersResponseSchema>;
export type BotReleasesResponse = z.infer<typeof botReleasesResponseSchema>;
export type BotEventsResponse = z.infer<typeof botEventsResponseSchema>;

export default {
	BOT_FEED_DEFAULT_LIMIT,
	BOT_FEED_MAX_LIMIT,
	botFeedLimitSchema,
	botFeedQuerySchema,
	botAddonAuthorSchema,
	botAddonSchema,
	botMemberSchema,
	botReleaseSchema,
	botActorSchema,
	botEventSchema,
	botAddonsResponseSchema,
	botMembersResponseSchema,
	botReleasesResponseSchema,
	botEventsResponseSchema,
};
