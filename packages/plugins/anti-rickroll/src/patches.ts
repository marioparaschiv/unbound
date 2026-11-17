import { dialogs, metro, patcher, utils } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import type { ReactNode } from 'react';

import { isRickroll, needsCheck, type Fetcher } from '~/lib/rickroll';

type LinkEvent = { nativeEvent?: { data?: { url?: string } } };

type ChatProps = { onTapLink?: (event: LinkEvent) => void };

async function guardLink(url: string, open: () => void) {
	if (!(await isRickroll(url, fetch as unknown as Fetcher))) {
		open();

		return;
	}

	dialogs.showDialog({
		title: messages.WARNING_TITLE,
		body: format('WARNING_BODY', { url }),
		buttons: [{ label: messages.OPEN_ANYWAY, variant: 'destructive', onPress: open }],
		cancel: messages.DONT_OPEN,
	});
}

function wrapChat(chat: ChatProps) {
	const original = chat.onTapLink;

	chat.onTapLink = (event) => {
		const url = event?.nativeEvent?.data?.url;

		if (!url || !needsCheck(url)) {
			original?.(event);

			return;
		}

		void guardLink(url, () => original?.(event));
	};
}

/**
 * @description Asks before opening a tapped link that leads to a Rickroll. Patches the render of `MessagesRenderer` to
 * wrap the chat's `onTapLink`; only YouTube links, short links and prank sites wait for the check.
 */
export function patchLinkTaps(): void {
	const MessagesRenderer = metro.findByFilePath('modules/messages/native/MessagesRenderer.tsx');

	if (!MessagesRenderer?.default) {
		logger.warn('Rickroll check skipped: Discord moved MessagesRenderer.');

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
