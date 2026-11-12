import { Type, type StaticDecode } from './schema';

export const DISCORD_COMPAT_PLATFORMS = ['ios', 'android'] as const;

const compatScanSchema = Type.Object({
	platform: Type.Enum(DISCORD_COMPAT_PLATFORMS),
	version: Type.String({ minLength: 1, maxLength: 32 }),
	build: Type.Optional(Type.String({ maxLength: 32 })),
	broken: Type.Integer({ minimum: 0, maximum: 100_000 }),
	fallbacks: Type.Integer({ minimum: 0, maximum: 100_000 }),
});

export const publishDiscordCompatRequestSchema = Type.Object({
	channel: Type.String({ minLength: 1, maxLength: 16 }),
	scans: Type.Array(compatScanSchema, { minItems: 1, maxItems: 20 }),
});

export const publishDiscordCompatResponseSchema = Type.Object({
	recorded: Type.Integer({ minimum: 0 }),
});

export type DiscordCompatPlatform = (typeof DISCORD_COMPAT_PLATFORMS)[number];

export type DiscordCompatScan = StaticDecode<typeof compatScanSchema>;

export type PublishDiscordCompatRequest = StaticDecode<typeof publishDiscordCompatRequestSchema>;

export default {
	DISCORD_COMPAT_PLATFORMS,
	publishDiscordCompatRequestSchema,
	publishDiscordCompatResponseSchema,
};
