import {
	Image,
	Pressable,
	View,
	type PressableStateCallbackType,
	type ViewStyle,
} from 'react-native';
import { definePlatform } from '@unbound-app/api/native';
import { assets, ui } from '@unbound-app/api';
import { createElement } from 'react';

import { patchSendButton as android } from './android/input-toggle';
import { patchRightActions as ios } from './ios/input-toggle';
import useStyles from './input-button.style';
import { useComposerState, useDraft } from './composer-state';
import type { ClosePanel } from './composer-stack';

export type InputButtonOptions = {
	key: string;
	name: string;
	icon: string;
	label: () => string;
	onPress: (channelId: string) => void;
	showWhenEmpty?: boolean;
	showForDraft?: (draft: string) => boolean;
};

type ButtonProps = InputButtonOptions & {
	channelId: string;
	assetId: number;
	trailingGap: number;
};

type RowProps = InputButtonOptions & { channelId: string; assetId: number; closePanel: ClosePanel };

function useShown(
	channelId: string,
	{ showWhenEmpty, showForDraft }: Pick<InputButtonOptions, 'showWhenEmpty' | 'showForDraft'>,
) {
	const state = useComposerState(channelId);
	const draft = useDraft(channelId);

	if (state === 'empty' && !showWhenEmpty) return false;

	return !showForDraft || showForDraft(draft);
}

function ActionRow({ channelId, label, onPress, assetId, closePanel, ...shown }: RowProps) {
	if (!useShown(channelId, shown)) return null;

	return createElement(ui.Row, {
		label: label(),
		icon: assetId,
		arrow: true,
		onPress: () => closePanel(() => onPress(channelId)),
	});
}

function ActionButton({
	channelId,
	label,
	onPress,
	assetId,
	trailingGap,
	showWhenEmpty,
	showForDraft,
}: ButtonProps) {
	const styles = useStyles();

	if (!useShown(channelId, { showWhenEmpty, showForDraft })) return null;

	return createElement(
		View,
		{ style: { marginRight: trailingGap } },
		createElement(
			Pressable,
			{
				accessibilityRole: 'button',
				accessibilityLabel: label(),
				onPress: () => onPress(channelId),
				hitSlop: 8,
				style: ({ pressed }: PressableStateCallbackType): ViewStyle[] => [
					styles.button,
					{ opacity: pressed ? 0.5 : 1, transform: [{ scale: pressed ? 0.86 : 1 }] },
				],
			},
			createElement(Image, {
				source: assetId,
				style: styles.icon,
			}),
		),
	);
}

const drawButton = definePlatform({ ios, android });

/**
 * @description Adds a button to the chat input, where the input's toggles go: in front of `ChatInputRightActions` on iOS
 * and of `ChatInputSendButton` on Android. It hides while the input is empty, since it acts on the draft, unless `showWhenEmpty` is set, and while
 * `showForDraft` rejects the draft.
 * @param options The button's key, icon, label and what it does.
 */
export function patchChatInputButton(options: InputButtonOptions): void {
	const assetId = assets.getIdByName(options.icon);

	if (assetId === undefined) {
		logger.warn(`${options.name} button skipped: its icon asset was not found.`);

		return;
	}

	const button = (channelId: string, trailingGap: number) =>
		createElement(ActionButton, {
			...options,
			key: options.key,
			channelId,
			assetId,
			trailingGap,
		});

	drawButton(button, options.name, options.key, {
		label: options.label,
		row: (channelId: string, closePanel: ClosePanel) =>
			createElement(ActionRow, {
				...options,
				key: options.key,
				channelId,
				assetId,
				closePanel,
			}),
	});
}

export default { patchChatInputButton };
