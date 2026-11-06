// The scenes read every colour through this map; `scripts/theme-maker-data.ts` ships only the tokens listed here.

export const SCENE_TOKENS = {
	// Shared: status dots, the notification badge, the header and text.
	statusOnline: 'ICON_STATUS_ONLINE',
	statusIdle: 'ICON_STATUS_IDLE',
	statusDnd: 'ICON_STATUS_DND',
	statusOffline: 'ICON_STATUS_OFFLINE',
	statusText: 'TEXT_MUTED',
	badge: 'BADGE_NOTIFICATION_BACKGROUND',
	badgeText: 'BADGE_NOTIFICATION_TEXT',
	headerIcon: 'MOBILE_HEADER_ICON_DEFAULT',
	iconDefault: 'ICON_DEFAULT',
	iconMuted: 'ICON_MUTED',
	textStrong: 'TEXT_STRONG',
	textDefault: 'TEXT_DEFAULT',
	textMuted: 'TEXT_MUTED',
	link: 'TEXT_LINK',
	divider: 'BORDER_SUBTLE',
	scrim: 'BACKGROUND_SCRIM',
	sheet: 'MOBILE_ACTIONSHEET_BACKGROUND',
	heading: 'MOBILE_TEXT_HEADING_PRIMARY',
	secondaryButton: 'CONTROL_SECONDARY_BACKGROUND_DEFAULT',
	secondaryButtonText: 'CONTROL_SECONDARY_TEXT_DEFAULT',
	primaryButton: 'CONTROL_PRIMARY_BACKGROUND_DEFAULT',
	primaryButtonText: 'CONTROL_PRIMARY_TEXT_DEFAULT',
	appTag: 'BADGE_PRIMARY_BACKGROUND',
	appTagText: 'BADGE_PRIMARY_TEXT',

	// Placeholder avatars, server icons and banners stand in for images, in the hues of Discord's default avatars.
	avatarBlurple: 'BACKGROUND_BRAND',
	avatarGreen: 'STATUS_POSITIVE',
	avatarYellow: 'BADGE_WARNING_BACKGROUND',
	avatarRed: 'STATUS_DANGER',
	avatarGrey: 'ICON_MUTED',
	avatarText: 'TEXT_OVERLAY_LIGHT',

	// Home and Server: the server rail, the DM list, the channel list and the floating "you" bar.
	rail: 'BACKGROUND_BASE_LOWEST',
	railIcon: 'MOBILE_GUILDBAR_ICON_BACKGROUND_DEFAULT',
	railIconGlyph: 'MOBILE_GUILDBAR_ICON_DEFAULT',
	railPill: 'INTERACTIVE_TEXT_ACTIVE',
	railFolder: 'GUILD_FOLDER_BACKGROUND',
	list: 'BACKGROUND_BASE_LOW',
	avatarCard: 'CARD_SECONDARY_BACKGROUND_DEFAULT',
	floatingBar: 'MOBILE_FLOATINGBAR_BACKGROUND',
	floatingBarBorder: 'MOBILE_FLOATING_ACCESSORY_BORDER',
	channelIcon: 'CHANNEL_ICON',
	channelName: 'CHANNELS_DEFAULT',
	channelNameUnread: 'REDESIGN_CHANNEL_NAME_TEXT',
	channelNameMuted: 'REDESIGN_CHANNEL_NAME_MUTED_TEXT',
	channelSelected: 'MOBILE_CHANNEL_ITEM_BACKGROUND_SELECTED',
	channelSelectedText: 'INTERACTIVE_TEXT_ACTIVE',
	speaking: 'STATUS_SPEAKING',
	voiceMuted: 'ICON_VOICE_MUTED',

	// Chat: header, messages, reply, embed, code, reactions, dividers, mention, typing and input.
	chat: 'CHANNEL_BACKGROUND_DEFAULT',
	headerBorder: 'STANDALONE_CHANNEL_HEADER_BORDER',
	replySpine: 'SPINE_DEFAULT',
	embed: 'EMBED_BACKGROUND',
	embedBorder: 'BORDER_SUBTLE',
	attachment: 'BACKGROUND_SURFACE_HIGH',
	code: 'BACKGROUND_CODE',
	codeText: 'TEXT_CODE',
	reactionReacted: 'REACTION_BACKGROUND_REACTED_DEFAULT',
	reactionReactedBorder: 'REACTION_BORDER_REACTED_DEFAULT',
	reactionReactedText: 'REACTION_TEXT_REACTED_DEFAULT',
	reaction: 'REACTION_BACKGROUND_DEFAULT',
	reactionBorder: 'REACTION_BORDER_DEFAULT',
	reactionText: 'REACTION_TEXT_DEFAULT',
	newDivider: 'MOBILE_CHAT_NEW_MESSAGE_BORDER',
	newDividerText: 'MOBILE_CHAT_NEW_MESSAGE_TEXT',
	mentionedRow: 'MESSAGE_MENTIONED_BACKGROUND_DEFAULT',
	mentionedGutter: 'STATUS_WARNING',
	mention: 'MENTION_BACKGROUND',
	mentionText: 'MENTION_FOREGROUND',
	typing: 'MOBILE_TYPING_INDICATOR_BACKGROUND_DEFAULT',
	chatInput: 'MOBILE_CHATINPUT_BACKGROUND_DEFAULT',
	chatInputBorder: 'MOBILE_CHATINPUT_BORDER_DEFAULT',
	chatInputPlaceholder: 'INPUT_PLACEHOLDER_TEXT_DEFAULT',
	chatInputIcon: 'CHAT_INPUT_ICON_DEFAULT_TINT',

	// Profile: the user profile sheet with its sections, custom status and role pills.
	profileSection: 'USER_PROFILE_CONTAINER_BACKGROUND',
	profileHeading: 'USER_PROFILE_ABOUT_ME_HEADING_TEXT',
	customStatus: 'CUSTOM_STATUS_BUBBLE_BG',
	rolePill: 'BADGE_SECONDARY_BACKGROUND',
	rolePillText: 'BADGE_SECONDARY_TEXT',

	// Settings: a search field, table rows, switches and a checkbox.
	input: 'INPUT_BACKGROUND_DEFAULT',
	inputBorder: 'INPUT_BORDER_DEFAULT',
	row: 'TABLEROW_BACKGROUND_DEFAULT',
	rowIcon: 'TABLEROW_ICON_COLOR_DEFAULT',
	switchOn: 'SWITCH_BACKGROUND_SELECTED_DEFAULT',
	switchOff: 'SWITCH_BACKGROUND_DEFAULT',
	switchOffBorder: 'SWITCH_BORDER_DEFAULT',
	switchThumb: 'SWITCH_THUMB_BACKGROUND_DEFAULT',
	checkboxOn: 'CHECKBOX_BACKGROUND_SELECTED_DEFAULT',
	checkboxIcon: 'CHECKBOX_ICON_ACTIVE',
} as const;

export type SceneElement = keyof typeof SCENE_TOKENS;

/** Looks up a scene element's resolved CSS colour. */
export type SceneColors = (element: SceneElement) => string;

export default { SCENE_TOKENS };
