import { onMessageRow, type RowMessage } from '@unbound-plugins/shared/metro/message-rows';

import { convertMessage } from '~/lib/messages';

type ContentMessage = RowMessage & {
	content?: string;
	set?: (key: 'content', value: string) => ContentMessage;
};

/**
 * @description Shows math in messages as Unicode as Discord builds their chat rows, from a copy of each message, so the
 * stored message keeps its TeX. Hooks `generateMessageRowData` before it runs.
 */
export function patchMessageRows(): void {
	onMessageRow<ContentMessage>({
		feature: 'Math notation',
		before({ input, message }) {
			if (!input || typeof message?.content !== 'string' || typeof message.set !== 'function')
				return undefined;

			const converted = convertMessage(message.content);

			if (converted === message.content) return undefined;

			return { input: { ...input, message: message.set('content', converted) } };
		},
	});
}
