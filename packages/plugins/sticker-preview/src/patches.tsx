import { cloneElement, isValidElement, type ComponentType, type ReactNode } from 'react';
import { metro, patcher } from '@unbound-app/api';

import type { Sticker } from '@unbound-plugins/shared/stickers/staged-stickers';
import type { AnyObject } from '@unbound-app/api/patcher';

import { createStaging, type SendButtonRef, type Staging } from '~/lib/staging';
import StickerPreview from '~/components/sticker-preview';
import { selectedChannelId } from '~/lib/selected-channel';
import type { StickerProps } from '~/lib/types';

type PickerRowProps = {
	channel?: { id?: string };
	onPressSticker?: (sticker: Sticker, ...args: unknown[]) => unknown;
};

type SendButtonProps = { channel?: { id?: string }; ref?: SendButtonRef };

type ContainerProps = { channel?: { id?: string } };

// The staged stickers of the running plugin, which `clearStagedStickers` drops at stop.
let staging: Staging | undefined;

/**
 * @description Stages picked stickers in the composer with a preview, and sends them with the message.
 * Patches the renders of `StickerPickerListRow`, `ChatInputSendButton` and `FloatingChatInputContainer`,
 * draws the preview with `Sticker`, and sends through `ChatInputs` and the message actions.
 * The patches only work together, so it applies none when Discord moved any of them.
 */
export function stageStickers(): void {
	const ChatInputs = metro.findByProps('getBestActiveInputForChannelId');
	const MessageActions = metro.api.Messages;
	const StickerModule = metro.findByFilePath('modules/stickers/native/Sticker.tsx');
	const StickerPickerListRow = metro.findByFilePath(
		'modules/stickers/native/StickerPickerListRow.tsx',
	);
	const ChatInputSendButton = metro.findByFilePath(
		'modules/chat_input/native/accessories/ChatInputSendButton.tsx',
	);
	const FloatingChatInputContainer = metro.findByFilePath(
		'modules/chat_input/native/FloatingChatInputContainer.tsx',
	);

	if (
		!ChatInputs ||
		!MessageActions ||
		!StickerModule ||
		!StickerPickerListRow ||
		!ChatInputSendButton ||
		!FloatingChatInputContainer
	) {
		logger.warn(
			'Sticker staging skipped: Discord moved ChatInputs, Messages, Sticker, StickerPickerListRow, ChatInputSendButton or FloatingChatInputContainer.',
		);

		return;
	}

	const staged = createStaging({ ChatInputs, MessageActions });

	staging = staged;
	patchStickerPickerListRow(StickerPickerListRow, staged);
	patchChatInputSendButton(ChatInputSendButton, staged);
	patchFloatingChatInputContainer(FloatingChatInputContainer, staged, StickerModule.default);
}

/**
 * @description Drops every staged sticker and restores Discord's send handlers and buttons. Call it once the patches
 * that read the staging are removed.
 */
export function clearStagedStickers(): void {
	staging?.dispose();
	staging = undefined;
}

// Stages a sticker picked from the picker instead of sending it.
function patchStickerPickerListRow(StickerPickerListRow: AnyObject, staged: Staging) {
	patcher.react.before(
		StickerPickerListRow,
		'default',
		({ props }: { props: PickerRowProps }) => {
			const onPressSticker = props.onPressSticker;

			if (typeof onPressSticker !== 'function') return;

			return {
				...props,
				onPressSticker: (sticker: Sticker, ...rest: unknown[]) => {
					const channelId = props.channel?.id ?? selectedChannelId();

					if (!channelId) return onPressSticker.call(props, sticker, ...rest);

					staged.stage(channelId, sticker);
				},
			};
		},
	);
}

// Lets the send button send a staged sticker, and keeps its ref so the plugin can update it.
function patchChatInputSendButton(ChatInputSendButton: AnyObject, staged: Staging) {
	patcher.react.before(
		ChatInputSendButton,
		'default',
		({ props }: { props: SendButtonProps }) => {
			const channelId = props.channel?.id;

			if (!channelId) return;

			if (props.ref) staged.trackSendButton(channelId, props.ref);

			if (!staged.get(channelId).length) return;

			return {
				...props,
				hasPendingAttachments: true,
				requireTextContent: false,
				onSendMessage: (...sendArgs: unknown[]) => staged.send(channelId, ...sendArgs),
			};
		},
	);
}

// Shows the staged sticker above the composer.
function patchFloatingChatInputContainer(
	FloatingChatInputContainer: AnyObject,
	staged: Staging,
	Sticker: ComponentType<StickerProps>,
) {
	patcher.react.after(
		FloatingChatInputContainer,
		'default',
		({ props, result }: { props: ContainerProps; result: ReactNode }) => {
			const channelId = props.channel?.id ?? selectedChannelId();

			if (!channelId || !isValidElement<{ children?: ReactNode }>(result)) return result;

			return cloneElement(
				result,
				{},
				<>
					{result.props.children}
					<StickerPreview
						key='sticker-preview'
						channelId={channelId}
						staging={staged}
						Sticker={Sticker}
					/>
				</>,
			);
		},
	);
}
