import type { SemanticColors } from '~/lib/theme-maker/theme-semantic';
import type { RawColors, ThemeBase } from '~/lib/theme-maker/ramp';
import { resolveToken } from '~/lib/theme-maker/scene-colors';

/** One colour advanced mode lets the user set, and the semantic tokens it writes. */
export type AdvancedOverride = {
	id: string;
	label: string;
	/** The first token is the one whose generated colour the field shows. */
	tokens: readonly string[];
};

export type AdvancedGroup = {
	label: string;
	overrides: AdvancedOverride[];
};

/** Override id to the `#rrggbb` the user picked. */
export type OverrideValues = Record<string, string>;

/** The curated colours advanced mode exposes, grouped; each writes semantic overrides on top of the generation. */
export const ADVANCED_GROUPS: AdvancedGroup[] = [
	{
		label: 'Surfaces',
		overrides: [
			{
				id: 'chat',
				label: 'Chat background',
				tokens: [
					'CHANNEL_BACKGROUND_DEFAULT',
					'MOBILE_TYPING_INDICATOR_BACKGROUND_DEFAULT',
				],
			},
			{ id: 'sidebar', label: 'Channel & DM list', tokens: ['BACKGROUND_BASE_LOW'] },
			{ id: 'rail', label: 'Server rail', tokens: ['BACKGROUND_BASE_LOWEST'] },
			{
				id: 'cards',
				label: 'Cards & embeds',
				tokens: ['EMBED_BACKGROUND', 'CARD_BACKGROUND_DEFAULT', 'BACKGROUND_SURFACE_HIGH'],
			},
			{
				id: 'chatInput',
				label: 'Chat input',
				tokens: ['MOBILE_CHATINPUT_BACKGROUND_DEFAULT'],
			},
			{
				id: 'floating',
				label: 'Floating bars & sheets',
				tokens: ['MOBILE_FLOATINGBAR_BACKGROUND', 'MOBILE_ACTIONSHEET_BACKGROUND'],
			},
		],
	},
	{
		label: 'Text',
		overrides: [
			{ id: 'textDefault', label: 'Normal', tokens: ['TEXT_DEFAULT'] },
			{
				id: 'textStrong',
				label: 'Names & headings',
				tokens: [
					'TEXT_STRONG',
					'MOBILE_TEXT_HEADING_PRIMARY',
					'REDESIGN_CHANNEL_NAME_TEXT',
				],
			},
			{ id: 'textMuted', label: 'Muted', tokens: ['TEXT_MUTED'] },
			{ id: 'link', label: 'Links', tokens: ['TEXT_LINK'] },
		],
	},
	{
		label: 'Accent',
		overrides: [
			{
				id: 'primaryButton',
				label: 'Primary buttons',
				tokens: ['CONTROL_PRIMARY_BACKGROUND_DEFAULT'],
			},
			{
				id: 'switches',
				label: 'Switches & checkboxes',
				tokens: [
					'SWITCH_BACKGROUND_SELECTED_DEFAULT',
					'CHECKBOX_BACKGROUND_SELECTED_DEFAULT',
				],
			},
			{
				id: 'reactions',
				label: 'Your reactions',
				tokens: ['REACTION_BACKGROUND_REACTED_DEFAULT', 'REACTION_BORDER_REACTED_DEFAULT'],
			},
		],
	},
	{
		label: 'Mentions',
		overrides: [
			{ id: 'mentionPill', label: 'Pill background', tokens: ['MENTION_BACKGROUND'] },
			{ id: 'mentionText', label: 'Pill text', tokens: ['MENTION_FOREGROUND'] },
			{
				id: 'mentionedRow',
				label: 'Mentioned message',
				tokens: ['MESSAGE_MENTIONED_BACKGROUND_DEFAULT'],
			},
			{ id: 'mentionedGutter', label: 'Message gutter', tokens: ['STATUS_WARNING'] },
		],
	},
	{
		label: 'Status',
		overrides: [
			{ id: 'online', label: 'Online', tokens: ['ICON_STATUS_ONLINE', 'TEXT_STATUS_ONLINE'] },
			{ id: 'idle', label: 'Idle', tokens: ['ICON_STATUS_IDLE', 'TEXT_STATUS_IDLE'] },
			{ id: 'dnd', label: 'Do Not Disturb', tokens: ['ICON_STATUS_DND', 'TEXT_STATUS_DND'] },
		],
	},
];

/** Every token advanced mode can write, for the data script to ship. */
export const ADVANCED_TOKENS: string[] = ADVANCED_GROUPS.flatMap((group) =>
	group.overrides.flatMap((override) => override.tokens),
);

const ADVANCED_OVERRIDES = ADVANCED_GROUPS.flatMap((group) => group.overrides);

function readOpacity(hex: string) {
	return hex.length === 9
		? Math.round((parseInt(hex.slice(7), 16) / 255) * 1e4) / 1e4
		: undefined;
}

/**
 * @description The colour each advanced field shows until the user sets it: its first token, as generated.
 * @param raws The generated raws.
 * @param base The Discord theme it builds on.
 * @param semantic The simple generation's semantic overrides.
 * @returns Override id to `#rrggbb`.
 */
export function getOverrideDefaults(
	raws: RawColors,
	base: ThemeBase,
	semantic: SemanticColors,
): OverrideValues {
	return Object.fromEntries(
		ADVANCED_OVERRIDES.map((override) => [
			override.id,
			resolveToken(override.tokens[0] ?? '', raws, base, semantic).slice(0, 7),
		]),
	);
}

/**
 * @description Writes the user's overrides as semantic colours. A token Discord draws translucent keeps its
 * generated opacity, so a picked colour tints it the way the original did.
 * @param values The picked colours, by override id.
 * @param raws The generated raws.
 * @param base The Discord theme it builds on.
 * @param semantic The simple generation's semantic overrides.
 * @returns The semantic overrides for every token of every set override.
 */
export function buildOverrideSemantic(
	values: OverrideValues,
	raws: RawColors,
	base: ThemeBase,
	semantic: SemanticColors,
): SemanticColors {
	const out: SemanticColors = {};

	for (const override of ADVANCED_OVERRIDES) {
		const value = values[override.id];

		if (!value) {
			continue;
		}

		for (const token of override.tokens) {
			const opacity = readOpacity(resolveToken(token, raws, base, semantic));

			out[token] =
				opacity === undefined
					? { type: 'color', value }
					: { type: 'color', value, opacity };
		}
	}

	return out;
}

export default { ADVANCED_GROUPS, ADVANCED_TOKENS, getOverrideDefaults, buildOverrideSemantic };
