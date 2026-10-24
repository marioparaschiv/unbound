import type { LatencyColor, LatencyOptions } from '~/latency';

export const Defaults: LatencyOptions = {
	latency: 2,
	showMillis: false,
	ignoreSelf: false,
	detectDiscordKotlin: true,
};

export const LATENCY_OPTIONS = [1, 2, 3, 5, 10];

export const DISCORD_EPOCH = 1_420_070_400_000;

// 2^22: a snowflake's timestamp is its value shifted right by 22 bits.
export const SNOWFLAKE_SHIFT = 4_194_304;

// Old Discord Android (Kotlin) clients generate nonces this far ahead of the message ID.
export const ANDROID_NONCE_OFFSET = 1_471_228_928;
export const ANDROID_OFFSET_TOLERANCE = 86_400_000;

export const MAX_LATENCY_RECORDS = 500;

export const CELL_SNAPSHOT = { maxDepth: 12, maxNodes: 120 };

export const Icon = {
	width: 12,
	height: 12,
	controlWidth: 16,
	controlHeight: 20,
	bars: [
		{ x: 1.2, y: 12.4, width: 2.4, height: 2.4 },
		{ x: 4.8, y: 8.8, width: 2.4, height: 6 },
		{ x: 8.4, y: 5.2, width: 2.4, height: 9.6 },
	],
};

export const FILL_TOKENS: Record<LatencyColor, string> = {
	danger: 'STATUS_DANGER',
	muted: 'TEXT_MUTED',
	positive: 'STATUS_POSITIVE',
	warning: 'STATUS_WARNING',
};

export const Tooltip = {
	maxWidth: 250,
	arrowHeight: 8,
	anchorGap: 3,
	fontSize: 13,
	duration: 3000,
};

// NSLayoutAttribute and NSLayoutRelation values from UIKit.
export const LayoutAttribute = {
	NotAnAttribute: 0,
	Leading: 5,
	Trailing: 6,
	Width: 7,
	Height: 8,
	CenterY: 10,
};

export const LAYOUT_RELATION_EQUAL = 0;
