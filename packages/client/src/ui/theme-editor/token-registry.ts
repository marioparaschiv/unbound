import type { TokenWrite } from '~/lib/theme-draft';

/** A curated row: one colour written to every linked token. The first link is the one shown. */
export type BasicRow = {
	key: string;
	label: string;
	tokens: readonly [TokenWrite, ...TokenWrite[]];
};

/** A titled group of basic rows on the editor's root screen. */
export type BasicCategory = {
	key: string;
	title: string;
	rows: readonly BasicRow[];
};

/** An advanced group: every live Discord token whose longest matching prefix is one of `prefixes`. */
export type AdvancedGroup = {
	key: string;
	title: string;
	prefixes: readonly string[];
};

/** The key of the advanced group that holds every token no prefix matches. */
export const OTHER_GROUP = 'other';

function row(key: string, label: string, ...tokens: [TokenWrite, ...TokenWrite[]]): BasicRow {
	return { key, label, tokens };
}

const link = (token: string, opacity?: number): TokenWrite => ({ token, opacity });

/** The curated colours shown first, by category. `label` and `title` are i18n keys. */
export const BASIC_CATEGORIES: readonly BasicCategory[] = [
	{
		key: 'backgrounds',
		title: 'UNBOUND_THEME_BACKGROUNDS',
		rows: [
			row('primary', 'UNBOUND_THEME_PRIMARY', link('BACKGROUND_BASE_LOWER')),
			row('secondary', 'UNBOUND_THEME_SECONDARY', link('BACKGROUND_BASE_LOWEST')),
			row('tertiary', 'UNBOUND_THEME_TERTIARY', link('BACKGROUND_BASE_LOW')),
			row(
				'surfaces',
				'UNBOUND_THEME_SURFACES',
				link('BACKGROUND_SURFACE_HIGH'),
				link('BACKGROUND_SURFACE_HIGHEST'),
				link('CARD_BACKGROUND_DEFAULT'),
				link('MOBILE_ACTIONSHEET_BACKGROUND'),
			),
			row(
				'chat-input',
				'UNBOUND_THEME_CHAT_INPUT',
				link('MOBILE_CHATINPUT_BACKGROUND_DEFAULT'),
				link('CHAT_INPUT_BACKGROUND'),
				link('REDESIGN_CHAT_INPUT_BACKGROUND'),
			),
			row(
				'tab-bar',
				'UNBOUND_THEME_TAB_BAR',
				link('TAB_BAR_BACKGROUND'),
				link('MOBILE_FLOATINGBAR_BACKGROUND'),
			),
		],
	},
	{
		key: 'text',
		title: 'UNBOUND_THEME_TEXT',
		rows: [
			row('default', 'UNBOUND_THEME_DEFAULT', link('TEXT_DEFAULT')),
			row(
				'strong',
				'UNBOUND_THEME_STRONG',
				link('TEXT_STRONG'),
				link('MOBILE_TEXT_HEADING_PRIMARY'),
			),
			row('muted', 'UNBOUND_THEME_MUTED', link('TEXT_MUTED'), link('TEXT_SUBTLE')),
			row('links', 'UNBOUND_THEME_LINKS', link('TEXT_LINK')),
		],
	},
	{
		key: 'icons',
		title: 'UNBOUND_THEME_ICONS',
		rows: [
			row(
				'default',
				'UNBOUND_THEME_DEFAULT',
				link('ICON_DEFAULT'),
				link('INTERACTIVE_ICON_DEFAULT'),
			),
			row('muted', 'UNBOUND_THEME_MUTED', link('ICON_MUTED'), link('ICON_SUBTLE')),
		],
	},
	{
		key: 'accent',
		title: 'UNBOUND_THEME_ACCENT',
		rows: [
			row(
				'brand',
				'UNBOUND_THEME_BRAND',
				link('BACKGROUND_BRAND'),
				link('TEXT_BRAND'),
				link('ICON_BRAND'),
				link('BACKGROUND_ACCENT'),
				link('BORDER_FOCUS'),
				link('INPUT_BORDER_ACTIVE'),
				link('SWITCH_BACKGROUND_SELECTED_DEFAULT'),
				link('CONTROL_BRAND_FOREGROUND'),
				link('CHAT_INPUT_SEND_BUTTON_ACTIVE_BACKGROUND'),
				link('MOBILE_SEGMENTED_CONTROL_INDICATOR_BACKGROUND'),
			),
			row(
				'mentions',
				'UNBOUND_THEME_MENTIONS',
				link('MENTION_FOREGROUND'),
				link('MENTION_BACKGROUND', 0.12),
			),
		],
	},
	{
		key: 'borders',
		title: 'UNBOUND_THEME_BORDERS',
		rows: [
			row(
				'borders',
				'UNBOUND_THEME_BORDERS',
				link('BORDER_SUBTLE'),
				link('BORDER_NORMAL'),
				link('BORDER_MUTED'),
			),
		],
	},
];

/** Every Discord token, grouped by name. The longest matching prefix wins; the last group catches the rest. */
export const ADVANCED_GROUPS: readonly AdvancedGroup[] = [
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
			'MOBILE_CHAT',
		],
	},
	{
		key: 'inputs',
		title: 'UNBOUND_THEME_INPUTS',
		prefixes: ['INPUT_', 'REDESIGN_INPUT_', 'CHAT_INPUT_', 'MOBILE_CHATINPUT_', 'DATEPICKER_'],
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
			'MOBILE_COACHMARK',
			'MOBILE_EXPRESSION',
			'MOBILE_TOAST',
		],
	},
	{
		key: 'navigation',
		title: 'UNBOUND_THEME_NAVIGATION',
		prefixes: [
			'TAB_',
			'TABLEROW_',
			'GUILD_',
			'NAVIGATOR_',
			'MOBILE_GUILDBAR',
			'MOBILE_FLOATINGBAR',
			'MOBILE_HEADER',
			'MOBILE_CHANNEL',
			'MOBILE_COMMAND',
		],
	},
	{ key: 'mobile', title: 'UNBOUND_THEME_MOBILE', prefixes: ['MOBILE_', 'ANDROID_'] },
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
			'CUSTOM_STATUS_',
		],
	},
	{
		key: 'expressive',
		title: 'UNBOUND_THEME_EXPRESSIVE',
		prefixes: ['EXPRESSIVE_', 'REDESIGN_', 'HEXAGON_', 'PROFILE_', 'PREMIUM_'],
	},
	{ key: OTHER_GROUP, title: 'UNBOUND_THEME_OTHER', prefixes: [] },
];

const PREFIXES = ADVANCED_GROUPS.flatMap(({ key, prefixes }) =>
	prefixes.map((prefix) => ({ key, prefix })),
).sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * @description Buckets token names into {@link ADVANCED_GROUPS} by their longest matching prefix.
 * @param names The live token names.
 * @returns Every group's sorted token names, keyed by group, unmatched names under {@link OTHER_GROUP}.
 */
export function groupTokens(names: readonly string[]): ReadonlyMap<string, readonly string[]> {
	const groups = new Map<string, string[]>(ADVANCED_GROUPS.map(({ key }) => [key, []]));

	for (const name of [...names].sort()) {
		const key = PREFIXES.find(({ prefix }) => name.startsWith(prefix))?.key ?? OTHER_GROUP;

		groups.get(key)?.push(name);
	}

	return groups;
}

/**
 * @description Drops the links a Discord build lacks from a category's rows, and rows left with none.
 * @param category The basic category.
 * @param names The live token names.
 * @returns The rows to show, each with only live links.
 */
export function availableRows(category: BasicCategory, names: ReadonlySet<string>): BasicRow[] {
	const rows: BasicRow[] = [];

	for (const basic of category.rows) {
		const [first, ...rest] = basic.tokens.filter(({ token }) => names.has(token));

		if (first) {
			rows.push({ ...basic, tokens: [first, ...rest] });
		}
	}

	return rows;
}

export default {
	OTHER_GROUP,
	BASIC_CATEGORIES,
	ADVANCED_GROUPS,
	groupTokens,
	availableRows,
};
