import { hideTargetWhileEmpty } from '@unbound-plugins/shared/composer/composer-stack';
import { channelOf } from '@unbound-plugins/shared/composer/toggle-channel';
import { metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { withoutGiftItem } from '~/lib/gift-item';
import { withoutIconButtons } from '~/lib/icon-buttons';
import { BOOST_GOAL_ROW, SERVER_BOOSTS_ROW, iconName, withoutRows } from '~/lib/upsells';

type GiftOrThreadProps = { hideGiftButton?: boolean };
type RightActionsProps = { shouldShowGiftButton?: boolean };
type YouIconProps = { IconComponent?: unknown };

const folder = 'modules/chat_input/native/action_buttons/';

/**
 * @description Hides the gift from the composer's gift-or-thread button, or the button itself when it has no gift option,
 * by patching the render of Discord's `ChatInputActionButtonGiftOrThread`.
 */
export function patchGiftOrThreadButton(): void {
	const GiftOrThreadButton = metro.findByFilePath(
		`${folder}ChatInputActionButtonGiftOrThread.tsx`,
	);

	if (!GiftOrThreadButton) {
		logger.warn('Gift button skipped: Discord moved ChatInputActionButtonGiftOrThread.');

		return;
	}

	patcher.react.instead(GiftOrThreadButton, 'default', ({ props, original }) => {
		const { hideGiftButton }: GiftOrThreadProps = props ?? {};

		if (!settings.gift) return original(props);

		return typeof hideGiftButton === 'boolean'
			? original({ ...props, hideGiftButton: true })
			: null;
	});
}

/**
 * @description Drops the animated slot that holds the gift button, by patching the render of Discord's `ChatInputRightActions`.
 */
export function patchChatInputRightActions(): void {
	const ChatInputRightActions = metro.findByFilePath(`${folder}ChatInputRightActions.tsx`);

	if (!ChatInputRightActions) {
		logger.warn('Gift slot skipped: Discord moved ChatInputRightActions.');

		return;
	}

	patcher.react.after(ChatInputRightActions, 'default', ({ props, result }) => {
		const { shouldShowGiftButton }: RightActionsProps = props ?? {};

		if (!settings.gift || !shouldShowGiftButton) return;

		return withoutGiftItem(result);
	});
}

/**
 * @description Hides the send button while the chat input holds no text or attachments, by patching the render of
 * Discord's `ChatInputSendButton`.
 */
export function patchEmptySendButton(): void {
	const SendButton = metro.findByFilePath(
		'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
	);

	if (!SendButton) {
		logger.warn('Send button skipped: Discord moved ChatInputSendButton.');

		return;
	}

	patcher.react.after(SendButton, 'default', ({ props, result }) => {
		if (!settings.emptySend || !result) return;

		const channelId = channelOf(props ?? {});

		if (!channelId) return;

		return hideTargetWhileEmpty(result, channelId);
	});
}

function callIcons(): Set<string> {
	return new Set([
		...(settings.voiceCall ? ['PhoneCallIcon'] : []),
		...(settings.videoCall ? ['VideoIcon'] : []),
	]);
}

/**
 * @description Hides the microphone that records a voice message, by patching the render of Discord's `VoiceMessageButton`.
 */
export function patchVoiceMessageButton(): void {
	const VoiceMessageButton = metro.findByFilePath(
		'modules/voice_messages/native/components/VoiceMessageButton.tsx',
	);

	if (!VoiceMessageButton) {
		logger.warn('Voice message button skipped: Discord moved VoiceMessageButton.');

		return;
	}

	patcher.react.instead(VoiceMessageButton, 'default', ({ props, original }) =>
		settings.voiceMessage ? null : original(props),
	);
	keepSendButton();
}

function keepSendButton(): void {
	const SendButton = metro.findByFilePath(
		'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
	)?.default;

	if (typeof SendButton?.type !== 'function') {
		logger.warn('Send button fallback skipped: Discord moved ChatInputSendButton.');

		return;
	}

	patcher.react.before(SendButton, 'type', ({ props }) =>
		settings.voiceMessage ? { ...(props as object), canSendVoiceMessage: false } : undefined,
	);
}

/**
 * @description Hides the voice and video call buttons in DM and group DM headers, by patching the render of Discord's
 * `PrivateChannelButtons`.
 */
export function patchPrivateChannelButtons(): void {
	const PrivateChannelButtons = metro.findByFilePath(
		'modules/main_tabs_v2/native/channel/header/PrivateChannelButtons.tsx',
	);

	if (!PrivateChannelButtons) {
		logger.warn('DM call buttons skipped: Discord moved PrivateChannelButtons.');

		return;
	}

	patcher.react.after(PrivateChannelButtons, 'default', ({ result }) =>
		withoutIconButtons(result, callIcons()),
	);
}

/**
 * @description Hides the call button on profiles, by patching the render of Discord's `UserProfileContactButtons`.
 */
export function patchProfileContactButtons(): void {
	const ContactButtons = metro.findByFilePath(
		'modules/user_profile/native/UserProfileContactButtons.tsx',
	);

	if (!ContactButtons) {
		logger.warn('Profile call button skipped: Discord moved UserProfileContactButtons.');

		return;
	}

	patcher.react.after(ContactButtons, 'default', ({ result }) =>
		withoutIconButtons(result, callIcons()),
	);
}

function hiddenYouIcons(): Set<string> {
	return new Set([
		...(settings.quests ? ['QuestsIcon'] : []),
		...(settings.shop ? ['ShopIcon'] : []),
		...(settings.nitroButton ? ['NitroWheelIcon'] : []),
	]);
}

/**
 * @description Hides the Quests and Shop buttons from the bar on the You screen, by patching the render of Discord's `YouScreenNavIcon`.
 */
export function patchYouScreenButtons(): void {
	const YouScreenNavIcon = metro.findByFilePath(
		'modules/main_tabs_v2/native/tabs/you/YouScreenNavIcon.tsx',
	);

	if (!YouScreenNavIcon) {
		logger.warn('Quests and Shop buttons skipped: Discord moved YouScreenNavIcon.');

		return;
	}

	patcher.react.instead(YouScreenNavIcon, 'default', ({ props, original }) => {
		const name = iconName((props as YouIconProps | undefined)?.IconComponent);

		return name && hiddenYouIcons().has(name) ? null : original(props);
	});
}

/**
 * @description Hides the Server Boosts row and the boost goal bar at the top of a server's channel list, by patching Discord's `useGuildActionRows`.
 */
export function patchGuildActionRows(): void {
	const GuildActionRows = metro.findByFilePath('modules/guild_sidebar/useGuildActionRows.tsx');

	if (!GuildActionRows) {
		logger.warn('Server Boosts row skipped: Discord moved useGuildActionRows.');

		return;
	}

	patcher.after(GuildActionRows, 'default', ({ result }) =>
		withoutRows(
			result,
			new Set([
				...(settings.serverBoosts ? [SERVER_BOOSTS_ROW] : []),
				...(settings.boostGoal ? [BOOST_GOAL_ROW] : []),
			]),
		),
	);
}
