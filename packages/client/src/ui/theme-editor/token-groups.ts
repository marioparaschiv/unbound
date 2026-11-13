import type enUS from '@i18n/en-US.json';

type MessageKey = keyof typeof enUS;

/** One curated colour: a pick writes it to every token, and the first token is the one shown. */
export type BasicColor = {
	label: MessageKey;
	tokens: readonly string[];
};

/** A titled group of curated colours on the editor's first page. */
export type BasicCategory = {
	title: MessageKey;
	colors: readonly BasicColor[];
};

/** A group of All Colors: every Discord token whose longest matching prefix is one of `prefixes`. */
export type ColorGroup = {
	key: string;
	title: MessageKey;
	prefixes: readonly string[];
};

/** The key of the group holding every token no prefix matches. */
const OTHER_GROUP = 'other';

/** The curated colours, by category. */
export const BASIC_CATEGORIES: readonly BasicCategory[] = [
	{
		title: 'UNBOUND_THEME_BACKGROUNDS',
		colors: [
			{ label: 'UNBOUND_THEME_PRIMARY', tokens: ['BACKGROUND_BASE_LOWER'] },
			{ label: 'UNBOUND_THEME_SECONDARY', tokens: ['BACKGROUND_BASE_LOWEST'] },
			{ label: 'UNBOUND_THEME_TERTIARY', tokens: ['BACKGROUND_BASE_LOW'] },
			{
				label: 'UNBOUND_THEME_SURFACES',
				tokens: [
					'BACKGROUND_SURFACE_HIGH',
					'BACKGROUND_SURFACE_HIGHEST',
					'CARD_BACKGROUND_DEFAULT',
					'MOBILE_ACTIONSHEET_BACKGROUND',
				],
			},
			{
				label: 'UNBOUND_THEME_CHAT_INPUT',
				tokens: ['CHAT_INPUT_BACKGROUND', 'MOBILE_CHATINPUT_BACKGROUND_DEFAULT'],
			},
		],
	},
	{
		title: 'UNBOUND_THEME_TEXT',
		colors: [
			{ label: 'UNBOUND_THEME_DEFAULT', tokens: ['TEXT_DEFAULT'] },
			{ label: 'UNBOUND_THEME_STRONG', tokens: ['TEXT_STRONG'] },
			{ label: 'UNBOUND_THEME_MUTED', tokens: ['TEXT_MUTED', 'TEXT_SUBTLE'] },
			{ label: 'UNBOUND_THEME_LINKS', tokens: ['TEXT_LINK'] },
		],
	},
	{
		title: 'UNBOUND_THEME_ICONS',
		colors: [
			{
				label: 'UNBOUND_THEME_DEFAULT',
				tokens: ['ICON_DEFAULT', 'INTERACTIVE_ICON_DEFAULT'],
			},
			{ label: 'UNBOUND_THEME_MUTED', tokens: ['ICON_MUTED', 'ICON_SUBTLE'] },
		],
	},
	{
		title: 'UNBOUND_THEME_ACCENT',
		colors: [
			{
				label: 'UNBOUND_THEME_BRAND',
				tokens: [
					'BACKGROUND_BRAND',
					'TEXT_BRAND',
					'ICON_BRAND',
					'CONTROL_BRAND_FOREGROUND',
					'SWITCH_BACKGROUND_SELECTED_DEFAULT',
					'MOBILE_SEGMENTED_CONTROL_INDICATOR_BACKGROUND',
				],
			},
			{
				label: 'UNBOUND_THEME_MENTIONS',
				tokens: ['MENTION_FOREGROUND', 'MENTION_BACKGROUND'],
			},
			{
				label: 'UNBOUND_THEME_BORDERS',
				tokens: ['BORDER_SUBTLE', 'BORDER_NORMAL', 'BORDER_MUTED'],
			},
		],
	},
];

/** The groups of All Colors. The longest matching prefix wins; the last group catches the rest. */
export const COLOR_GROUPS: readonly ColorGroup[] = [
	{ key: 'backgrounds', title: 'UNBOUND_THEME_BACKGROUNDS', prefixes: ['BACKGROUND_', 'BG_'] },
	{ key: 'text', title: 'UNBOUND_THEME_TEXT', prefixes: ['TEXT_', 'MOBILE_TEXT_'] },
	{ key: 'icons', title: 'UNBOUND_THEME_ICONS', prefixes: ['ICON_'] },
	{ key: 'borders', title: 'UNBOUND_THEME_BORDERS', prefixes: ['BORDER_', 'APP_FRAME_'] },
	{
		key: 'controls',
		title: 'UNBOUND_THEME_CONTROLS',
		prefixes: [
			'BUTTON_',
			'CONTROL_',
			'REDESIGN_BUTTON_',
			'TOGGLEBUTTON_',
			'SWITCH_',
			'CHECKBOX_',
			'RADIO_',
			'SLIDER_',
			'PROGRESSBAR_',
			'MOBILE_SEGMENTED_',
		],
	},
	{ key: 'interactive', title: 'UNBOUND_THEME_INTERACTIVE', prefixes: ['INTERACTIVE_'] },
	{
		key: 'chat',
		title: 'UNBOUND_THEME_CHAT',
		prefixes: [
			'CHAT_',
			'CHANNEL',
			'MESSAGE_',
			'MESSAGES_',
			'MENTION_',
			'REACTION_',
			'EMBED_',
			'SPOILER_',
			'POLLS_',
			'THREAD_',
			'INPUT_',
			'DATEPICKER_',
			'MOBILE_CHAT',
		],
	},
	{
		key: 'surfaces',
		title: 'UNBOUND_THEME_SURFACES',
		prefixes: [
			'CARD_',
			'MODAL_',
			'PANEL_',
			'OVERLAY_',
			'CONTEXT_MENU_',
			'BLUR_',
			'LEGACY_',
			'MOBILE_ACTIONSHEET',
			'MOBILE_ALERT',
			'MOBILE_LEGACY',
		],
	},
	{
		key: 'status',
		title: 'UNBOUND_THEME_STATUS',
		prefixes: [
			'STATUS_',
			'BADGE_',
			'TOAST_',
			'INLINENOTICE_',
			'NOTICE_',
			'VOICE_',
			'MOBILE_VOICE',
			'USER_',
		],
	},
	{
		key: 'expressive',
		title: 'UNBOUND_THEME_EXPRESSIVE',
		prefixes: ['EXPRESSIVE_', 'REDESIGN_', 'HEXAGON_', 'PROFILE_', 'PREMIUM_'],
	},
	{ key: 'mobile', title: 'UNBOUND_THEME_MOBILE', prefixes: ['MOBILE_', 'ANDROID_'] },
	{ key: OTHER_GROUP, title: 'UNBOUND_THEME_OTHER', prefixes: [] },
];

const PREFIXES = COLOR_GROUPS.flatMap(({ key, prefixes }) =>
	prefixes.map((prefix) => ({ key, prefix })),
).sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * @description Sorts token names into {@link COLOR_GROUPS} by their longest matching prefix.
 * @param names The token names.
 * @returns Each group's sorted token names, by group key.
 */
export function groupTokens(names: readonly string[]): Map<string, string[]> {
	const groups = new Map<string, string[]>(COLOR_GROUPS.map(({ key }) => [key, []]));

	for (const name of [...names].sort()) {
		const key = PREFIXES.find(({ prefix }) => name.startsWith(prefix))?.key ?? OTHER_GROUP;

		groups.get(key)?.push(name);
	}

	return groups;
}

/**
 * @description Spells a token name as words, so a long one wraps between words.
 * @param name The token name, such as `BACKGROUND_BASE_LOWER`.
 * @returns The label, such as `Background Base Lower`.
 */
export function tokenLabel(name: string): string {
	return name
		.toLowerCase()
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/**
 * @description Keeps the curated colours this Discord build has, dropping tokens it lacks.
 * @param category The category.
 * @param names The token names Discord has.
 * @returns The colours left, each with at least one token.
 */
export function availableColors(category: BasicCategory, names: ReadonlySet<string>): BasicColor[] {
	return category.colors
		.map((color) => ({ ...color, tokens: color.tokens.filter((token) => names.has(token)) }))
		.filter((color) => color.tokens.length > 0);
}
