import { settings } from '@unbound-app/settings';

import { onMessageRow, type RowMessage } from '@unbound-plugins/shared/metro/message-rows';

import { targetSystem } from '~/lib/region';
import { convertText } from '~/lib/units';

type ContentMessage = RowMessage & {
	content?: string;
	set?: (key: 'content', value: string) => ContentMessage;
};

/**
 * @description Adds unit conversions to messages as Discord builds their chat rows, from a copy of each message, so the stored message and its edits keep the original text.
 * Hooks `generateMessageRowData` before it runs.
 */
export function patchMessageRows(): void {
	onMessageRow<ContentMessage>({
		feature: 'Unit conversions',
		before({ input, message }) {
			if (
				!input ||
				typeof message?.content !== 'string' ||
				typeof message.set !== 'function'
			) {
				return undefined;
			}

			const converted = convertText(message.content, targetSystem(settings.system));

			if (converted === message.content) return undefined;

			return { input: { ...input, message: message.set('content', converted) } };
		},
	});
}
