import { metro, patcher, toasts, utils } from '@unbound-app/api';
import { format } from '@unbound-app/i18n';
import type { ReactNode } from 'react';

type InlineCodeEvent = { nativeEvent?: { node?: { content?: string } } };

type ChatProps = { onTapInlineCode?: (event: InlineCodeEvent) => void };

const PREVIEW_LENGTH = 40;

function copyCode(code: string) {
	metro.common.Clipboard.setString(code);

	const preview = code.length > PREVIEW_LENGTH ? `${code.slice(0, PREVIEW_LENGTH - 1)}…` : code;

	toasts.show({ title: addon.name, content: format('COPIED', { code: preview }) });
}

function wrapChat(chat: ChatProps) {
	const original = chat.onTapInlineCode;

	chat.onTapInlineCode = (event) => {
		const code = event?.nativeEvent?.node?.content;

		if (code) {
			copyCode(code);

			return;
		}

		original?.(event);
	};
}

/**
 * @description Copies inline code when it is tapped, instead of Discord's share bubble. Patches the render of
 * `MessagesRenderer` to wrap the chat's `onTapInlineCode`, whose event carries the code.
 */
export function patchInlineCodeTaps(): void {
	const MessagesRenderer = metro.findByFilePath('modules/messages/native/MessagesRenderer.tsx');

	if (!MessagesRenderer?.default) {
		logger.warn('Inline code taps skipped: Discord moved MessagesRenderer.');

		return;
	}

	patcher.react.after(MessagesRenderer, 'default', ({ result }) => {
		const chat = utils.react.findInTree(
			result as ReactNode,
			(node: unknown) => typeof (node as ChatProps | null)?.onTapInlineCode === 'function',
		) as ChatProps | undefined;

		if (chat) wrapChat(chat);
	});
}
