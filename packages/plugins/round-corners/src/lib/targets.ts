import { classicTokens, overrideToken, roundTokens } from '~/lib/tokens';
import { FULL, rules, type Rule } from '~/lib/rounder';

/** A setting of this plugin that turns a target on. */
export type TargetSetting =
	| 'serverIcons'
	| 'serverBarButtons'
	| 'youBar'
	| 'chatButtons'
	| 'chatInput'
	| 'youNav'
	| 'otherCorners';

/** One set of squares Round Corners rounds, behind its own setting. Ported from bleelblep's Fuck Squares. */
export type Target = {
	setting: TargetSetting;
	/** The components whose render output gets re-rounded, by module path and export. */
	components: { path: string; export?: string }[];
	rule: Rule;
	/** Whether the rounding also reaches into the components the target renders, such as the You bar's masked background. */
	deep?: boolean;
	/** Token overrides for corners no render output shows. */
	tokens?: (active: () => boolean) => void;
};

/** Reads whether the selected server keeps Discord's rounded square. */
export type SelectedShape = () => 'classic' | 'round';

const YOU_BAR = 'modules/main_tabs_v2/native/you_bar/';
const CHAT = 'modules/chat_input/native/';

/**
 * @description Lists every target, with the server icon rule reading how the selected server should look.
 * @param selectedShape Whether the selected server stays a rounded square (`classic`) or turns round too.
 * @returns The targets.
 */
export function targets(selectedShape: SelectedShape): Target[] {
	return [
		{
			setting: 'serverIcons',
			components: [{ path: 'modules/guild/native/GuildIcon.tsx' }],
			rule: ({ width, height, radius }, props) => {
				if (width === undefined || height === undefined || Math.abs(width - height) >= 1)
					return undefined;
				if (
					selectedShape() === 'classic' &&
					(props as { selected?: boolean } | undefined)?.selected
				)
					return undefined;

				return radius < width / 2 ? width / 2 : undefined;
			},
		},
		{
			setting: 'serverBarButtons',
			components: [
				{ path: 'modules/guilds_bar/native/GuildsBarDirectMessage.tsx' },
				{ path: 'modules/guilds_bar/native/GuildsBarCreateJoinButton.tsx' },
				{ path: 'modules/guilds_bar/native/GuildsBarMessages.tsx' },
			],
			rule: rules.circleIfSquare(56),
		},
		{
			setting: 'youBar',
			components: [
				...[
					'YouBar',
					'YouBarBackground',
					'YouBarButton',
					'YouBarNotificationsButton',
					'YouBarICYMIButton',
					'YouBarAvatar',
				].map((name) => ({ path: `${YOU_BAR}${name}.tsx` })),
				{ path: `${YOU_BAR}YouBarButton.tsx`, export: 'YouBarButtonContainer' },
				{ path: `${YOU_BAR}YouBarButton.tsx`, export: 'YouBarButtonIcon' },
			],
			rule: rules.fullRoundIf(8),
			deep: true,
			tokens: (active) => overrideToken('YOU_BAR_BORDER_RADIUS', active, () => FULL),
		},
		{
			setting: 'chatButtons',
			components: [
				{ path: `${CHAT}action_buttons/ChatInputActionButton.tsx` },
				{ path: `${CHAT}accessories/ChatInputExpressionButton.tsx` },
				{ path: `${CHAT}EmojiSuggestionChatButton.tsx` },
			],
			rule: rules.circleIfSquare(44),
		},
		{
			setting: 'chatInput',
			components: [],
			rule: () => undefined,
			tokens: (active) => {
				overrideToken('CHAT_INPUT_FLOATING_BORDER_RADIUS', active, (stock) =>
					Math.max(stock, 24),
				);
				overrideToken('CHAT_INPUT_BORDER_RADIUS', active, (stock) => Math.max(stock, 24));
			},
		},
		{
			setting: 'otherCorners',
			components: [],
			rule: () => undefined,
			tokens: (active) => {
				roundTokens(
					[
						'GUILD_FOLDER_BACKGROUND_RADIUS',
						'CHANNEL_ITEM_RADIUS',
						'CHANNEL_NAME_CHANNEL_ICON_RADIUS',
						'INPUT_FIELD_RADIUS_LG',
						'INPUT_FIELD_RADIUS_MD',
						'INPUT_FIELD_RADIUS_SM',
						'INPUT_FIELD_ROUND_RADIUS',
						'SEGMENTED_CONTROL_BORDER_RADIUS',
						'MEDIA_KEYBOARD_BAR_BORDER_RADIUS',
						'MEDIA_KEYBOARD_BUTTON_BORDER_RADIUS',
						'VOICE_MESSAGE_RECORDING_PILL_BORDER_RADIUS',
						'VOICE_PANEL_CONTROLS_BORDER_RADIUS',
						'QUEST_DOCK_BORDER_RADIUS',
						'button.BORDER_RADIUS',
						'button.BORDER_RADIUS_LG',
					],
					active,
				);
				classicTokens(
					[
						'TABLE_ROW_BORDER_RADIUS',
						'CARD_DEFAULT_RADIUS',
						'CHANNEL_DRAWER_CORNER_RADIUS',
						'CONTROL_CHECKBOX_BORDER_RADIUS',
						'MOBILE_KEYBOARD_TOP_BORDER_RADIUS',
						'MOBILE_MEDIA_KEYBOARD_TOP_BORDER_RADIUS',
						'VOICE_TILE_BORDER_RADIUS',
						'BOUNTY_TILE_BORDER_RADIUS',
					],
					active,
				);
			},
		},
		{
			setting: 'youNav',
			components: [
				{ path: 'modules/main_tabs_v2/native/tabs/you/YouBannerDecorations.tsx' },
				{ path: 'modules/main_tabs_v2/native/tabs/you/YouScreenNavIcon.tsx' },
			],
			rule: rules.fullRoundIf(12),
		},
	];
}

export default targets;
