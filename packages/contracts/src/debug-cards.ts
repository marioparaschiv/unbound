import { Type, type StaticDecode } from './schema';

export const DEBUG_CARD_ALT_TEXT_LIMIT = 1024;

export const DEBUG_CARD_SUPPORT = ['supported', 'untested', 'unsupported', 'broken'] as const;

export const DEBUG_CARD_BUNDLE_STATES = ['active', 'trial', 'discarded', 'rolled back'] as const;

export const DEBUG_CARD_EXITS = ['crashed', 'ended', 'unknown'] as const;

export const DEBUG_CARD_THERMAL = ['nominal', 'fair', 'serious', 'critical'] as const;

const text = (maxLength = 128) => Type.String({ maxLength });

const addonCountSchema = Type.Object({
	enabled: Type.Integer({ minimum: 0, maximum: 100_000 }),
	installed: Type.Integer({ minimum: 0, maximum: 100_000 }),
});

const launchSchema = Type.Object({
	bundle: Type.Enum(DEBUG_CARD_BUNDLE_STATES),
	earlyCloses: Type.Integer({ minimum: 0, maximum: 1_000 }),
	recovery: Type.Boolean(),
	previousExit: Type.Enum(DEBUG_CARD_EXITS),
	lastCrash: Type.Optional(text(200)),
	firstRenderMs: Type.Optional(Type.Integer({ minimum: 0, maximum: 3_600_000 })),
	crashes: Type.Optional(
		Type.Array(Type.Object({ at: Type.Integer({ minimum: 0 }), crash: text(200) }), {
			maxItems: 5,
		}),
	),
});

const memorySchema = Type.Object({
	availableMB: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000_000 })),
	lowMemory: Type.Optional(Type.Boolean()),
	memoryWarnings: Type.Optional(Type.Integer({ minimum: 0, maximum: 100_000 })),
	thermal: Type.Optional(Type.Enum(DEBUG_CARD_THERMAL)),
});

const heapSchema = Type.Object({
	heapMB: Type.Number({ minimum: 0, maximum: 1_000_000 }),
	gcMs: Type.Number({ minimum: 0, maximum: 1_000_000_000 }),
});

export const debugCardRequestSchema = Type.Object({
	client: text(64),
	commit: text(64),
	loader: text(64),
	loaderOrigin: text(),
	framework: text(),
	jailbreak: Type.Optional(text()),
	discord: text(64),
	discordChannel: text(16),
	discordBuild: text(64),
	discordSupport: Type.Optional(Type.Enum(DEBUG_CARD_SUPPORT)),
	appSource: text(),
	installDetails: Type.Optional(text(256)),
	react: text(64),
	reactNative: text(64),
	hermes: text(64),
	bytecode: text(16),
	platform: text(16),
	os: text(),
	device: text(),
	flags: Type.Array(text(32), { maxItems: 8 }),
	plugins: Type.Optional(addonCountSchema),
	themes: Type.Optional(addonCountSchema),
	disabledAddons: Type.Optional(Type.Array(text(160), { maxItems: 64 })),
	locale: Type.Optional(text(35)),
	theme: Type.Optional(text()),
	iconPack: Type.Optional(text()),
	launch: Type.Optional(launchSchema),
	bundleChannel: Type.Optional(text(16)),
	memory: Type.Optional(memorySchema),
	heap: Type.Optional(heapSchema),
});

export const debugCardResponseSchema = Type.Object({
	image: Type.String(),
	width: Type.Integer({ minimum: 1 }),
	height: Type.Integer({ minimum: 1 }),
	altText: Type.String({ maxLength: DEBUG_CARD_ALT_TEXT_LIMIT }),
});

export type DebugCardRequest = StaticDecode<typeof debugCardRequestSchema>;

export type DebugCardResponse = StaticDecode<typeof debugCardResponseSchema>;

export type DebugCardAddonCount = StaticDecode<typeof addonCountSchema>;

export type DebugCardLaunch = StaticDecode<typeof launchSchema>;

export type DebugCardSupport = (typeof DEBUG_CARD_SUPPORT)[number];

export type DebugCardMemory = StaticDecode<typeof memorySchema>;

export default {
	DEBUG_CARD_ALT_TEXT_LIMIT,
	DEBUG_CARD_SUPPORT,
	DEBUG_CARD_BUNDLE_STATES,
	DEBUG_CARD_EXITS,
	DEBUG_CARD_THERMAL,
	debugCardRequestSchema,
	debugCardResponseSchema,
};
