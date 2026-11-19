import { metro, patcher, utils } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';

import { readMusicLink, searchLink, type Service } from '~/lib/links';
import { searchQuery, type Fetcher } from '~/lib/metadata';

type LinkEvent = { nativeEvent?: { data?: { url?: string } } };
type ChatProps = { onTapLink?: (event: LinkEvent) => void };

const LOOKUP_TIMEOUT_MS = 4000;

function withTimeout<T>(pending: Promise<T>): Promise<T | undefined> {
	return Promise.race([
		pending,
		new Promise<undefined>((resolve) => setTimeout(resolve, LOOKUP_TIMEOUT_MS)),
	]);
}

async function openConverted(url: string, open: () => void) {
	const link = readMusicLink(url);
	const target = settings.service as Service;

	if (!link || link.service === target) {
		open();

		return;
	}

	try {
		const query = await withTimeout(searchQuery(link, fetch as unknown as Fetcher));

		if (query) {
			await Linking.openURL(searchLink(target, query));

			return;
		}
	} catch (error) {
		logger.error(`Failed to convert music link ${url}:`, error);
	}

	open();
}

function wrapChat(chat: ChatProps) {
	const original = chat.onTapLink;

	chat.onTapLink = (event) => {
		const url = event?.nativeEvent?.data?.url;

		if (!url || !readMusicLink(url)) {
			original?.(event);

			return;
		}

		void openConverted(url, () => original?.(event));
	};
}

/**
 * @description Opens music links tapped in the chat in the chosen service. Patches the render of `MessagesRenderer` to
 * wrap the chat's `onTapLink`; other links open as before.
 */
export function patchLinkTaps(): void {
	const MessagesRenderer = metro.findByFilePath('modules/messages/native/MessagesRenderer.tsx');

	if (!MessagesRenderer?.default) {
		logger.warn('Song Link Converter skipped: Discord moved MessagesRenderer.');

		return;
	}

	patcher.react.after(MessagesRenderer, 'default', ({ result }) => {
		const chat = utils.react.findInTree(
			result as ReactNode,
			(node: unknown) => typeof (node as ChatProps | null)?.onTapLink === 'function',
		) as ChatProps | undefined;

		if (chat) wrapChat(chat);
	});
}

export default patchLinkTaps;
