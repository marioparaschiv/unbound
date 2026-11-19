import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { metro, patcher, utils } from '@unbound-app/api';
import type { ComponentType, ReactNode } from 'react';

import { PlayerSheet, type WebViewProps } from '~/components/player-sheet';
import { soundcloudLink } from '~/lib/soundcloud';

type LinkEvent = { nativeEvent?: { data?: { url?: string } } };
type ChatProps = { onTapLink?: (event: LinkEvent) => void };
type WebViewModule = { WebView?: ComponentType<WebViewProps> };

const SHEET_KEY = 'unbound-soundcloud-player';

function wrapChat(chat: ChatProps, WebView: ComponentType<WebViewProps>) {
	const original = chat.onTapLink;

	chat.onTapLink = (event) => {
		const link = soundcloudLink(event?.nativeEvent?.data?.url ?? '');

		if (!link) {
			original?.(event);

			return;
		}

		openSheet(SHEET_KEY, PlayerSheet, { link, WebView });
	};
}

/**
 * @description Plays SoundCloud links tapped in the chat in a sheet. Patches the render of `MessagesRenderer` to wrap
 * the chat's `onTapLink`; other links open as before.
 */
export function patchLinkTaps(): void {
	const MessagesRenderer = metro.findByFilePath('modules/messages/native/MessagesRenderer.tsx');
	const WebView = (metro.findByProps('WebView') as WebViewModule | undefined)?.WebView;

	if (!MessagesRenderer?.default || !WebView) {
		logger.warn('SoundCloud Player skipped: Discord moved MessagesRenderer or WebView.');

		return;
	}

	patcher.react.after(MessagesRenderer, 'default', ({ result }) => {
		const chat = utils.react.findInTree(
			result as ReactNode,
			(node: unknown) => typeof (node as ChatProps | null)?.onTapLink === 'function',
		) as ChatProps | undefined;

		if (chat) wrapChat(chat, WebView);
	});
}

export default patchLinkTaps;
