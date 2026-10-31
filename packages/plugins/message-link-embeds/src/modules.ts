import type { MetroFunction } from '@unbound-app/api/metro';
import type { FluxStore } from '@unbound-app/api/flux';
import type { ComponentType } from 'react';
import { metro, flux } from '@unbound-app/api';

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

/** A running platform's embeds: how many are drawn, and the cleanup `stop` returns. */
export type Embeds = {
	drawn: () => number;
	dispose: () => Promise<void> | undefined;
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

type MessageStoreType = FluxStore & {
	getMessage: (channelId: string, messageId: string) => Message | undefined;
	getMessages: (channelId: string) => { _array: Message[] } | undefined;
	getLastMessage: (channelId: string) => Message | undefined;
};

type MessageActionsType = {
	fetchMessage: (target: LinkTarget) => Promise<Message | null>;
};

type ComponentHolder = {
	default?: unknown;
	type?: unknown;
	render?: unknown;
};

export const MessageStore = flux.getStore('Message', { lazy: true }) as MessageStoreType;
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const SelectedChannelStore = flux.getStore('SelectedChannel', { lazy: true });

export const MessageActions = metro.api.Messages as MessageActionsType;

export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });

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
		metro.findByFilePath('components_native/chat/ChatItem.tsx', {
			interop: false,
			lazy: false,
		}) ??
		metro.findByProps(
			'DCDMessageView',
			'DCDSystemMessageView',
			'DCDAutoModerationSystemMessageView',
			{ interop: false, lazy: false },
		);

	return {
		MessageRecord: metro.findByName('MessageRecord', { lazy: false }),
		RowManager: metro.findByName('RowManager', { lazy: false }),
		ChatItem: unwrapComponent(chatItemModule?.default) ?? unwrapComponent(chatItemModule),
	};
}
