import type { MetroFunction } from '@unbound-app/api/metro';
import type { ComponentType } from 'react';
import { metro, patcher } from '@unbound-app/api';

import type { LinkTarget } from '~/link-targets';

export type Message = {
	id: string;
	content?: unknown;
	reactions?: unknown;
	timestamp?: Date | string;
	[field: string]: unknown;
};

export type RowGenerator = {
	generate: (input: RowInput) => Row | undefined;
	setOptions: (options: RowOptions) => void;
};

export type ChatItemProps = {
	message: Message;
	renderRevision: number;
	rowGenerator: RowGenerator;
};

export type Renderers = {
	MessageRecord: MetroFunction;
	RowManager: MetroFunction;
	ChatItem: ComponentType<ChatItemProps>;
};

type RowInput = {
	message: Message;
	rowType: number;
	changeType: number;
	isFirst: boolean;
	canAddNewReactions: boolean;
	canShowImages: boolean;
};

type RowOptions = {
	animateEmoji: boolean;
	animatingStickerMessageId: string;
	gifAutoPlay: boolean;
};

type Row = {
	message?: Message;
	renderContentOnly?: boolean;
	separatorBefore?: boolean;
};

type MessageStoreType = {
	getMessage: (channelId: string, messageId: string) => Message | undefined;
	getMessages: (channelId: string) => { _array: Message[] } | undefined;
	getLastMessage: (channelId: string) => Message | undefined;
	addChangeListener: (listener: () => void) => void;
	removeChangeListener: (listener: () => void) => void;
};

type ChannelStoreType = {
	getChannel: (channelId: string) => { name?: string } | undefined;
};

type SelectedChannelStoreType = {
	getChannelId: () => string | undefined;
	getLastSelectedChannelId: () => string | undefined;
};

type MessageActionsType = {
	fetchMessage: (target: LinkTarget) => Promise<Message | null>;
};

type ComponentHolder = {
	default?: unknown;
	type?: unknown;
	render?: unknown;
};

export const MessageStore = metro.findStore('Message', { lazy: true }) as MessageStoreType;
export const ChannelStore = metro.findStore('Channel', { lazy: true }) as ChannelStoreType;
export const SelectedChannelStore = metro.findStore('SelectedChannel', {
	lazy: true,
}) as SelectedChannelStoreType;

export const MessageActions = metro.api.Messages as MessageActionsType;

export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });

export const Patcher = patcher.createPatcher('unbound.message-link-embeds');

// The media components patched to play inside embeds, loaded when Discord first shows media.
export const FastImageSource = 'components_native/common/FastImage.tsx';
export const LottieAnimationViewSource = 'components_native/common/LottieAnimationView.tsx';
export const NativeLottieViewSource = 'modules/stickers/native/NativeLottieView.tsx';

// ChatItem is exported wrapped in `memo`, `forwardRef`, or a module default, a few layers deep.
function unwrapComponent(
	value: unknown,
	depth: number = 0,
): ComponentType<ChatItemProps> | undefined {
	if (typeof value === 'function') return value as ComponentType<ChatItemProps>;
	if (!value || typeof value !== 'object' || depth >= 5) return;

	const holder = value as ComponentHolder;

	return unwrapComponent(holder.type ?? holder.render ?? holder.default, depth + 1);
}

/**
 * @description Finds the classes and component Discord renders a chat row with. Metro's lazy proxy cannot be constructed or rendered, so these resolve when called.
 * @returns `MessageRecord`, `RowManager`, and the `ChatItem` component, each `undefined` when not found.
 */
export function findRenderers(): Partial<Renderers> {
	// A build that moves ChatItem's file still exports these message views beside it.
	const chatItemModule =
		metro.findByFilePath('components_native/chat/ChatItem.tsx', { interop: false }) ??
		metro.findByProps(
			'DCDMessageView',
			'DCDSystemMessageView',
			'DCDAutoModerationSystemMessageView',
			{ interop: false },
		);

	return {
		MessageRecord: metro.findByName('MessageRecord'),
		RowManager: metro.findByName('RowManager'),
		ChatItem: unwrapComponent(chatItemModule?.default) ?? unwrapComponent(chatItemModule),
	};
}
