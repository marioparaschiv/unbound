import { onMessageRow, type RowMessage } from '@unbound-plugins/shared/metro/message-rows';
import { settings } from '@unbound-app/settings';

import { targetCurrency } from '~/lib/target';
import { convertText } from '~/lib/convert';
import { savedRates } from '~/lib/rates';

type ContentMessage = RowMessage & {
	content?: string;
	set?: (key: 'content', value: string) => ContentMessage;
};

/**
 * @description Adds currency conversions to messages as Discord builds their chat rows, from a copy of each message,
 * so the stored message and its edits keep the original text. Hooks `generateMessageRowData` before it runs.
 */
export function patchMessageRows(): void {
	onMessageRow<ContentMessage>({
		feature: 'Currency conversions',
		before({ input, message }) {
			const rates = savedRates();

			if (
				!rates ||
				!input ||
				typeof message?.content !== 'string' ||
				typeof message.set !== 'function'
			) {
				return undefined;
			}

			const converted = convertText(
				message.content,
				targetCurrency(settings.currency),
				rates,
			);

			if (converted === message.content) return undefined;

			return { input: { ...input, message: message.set('content', converted) } };
		},
	});
}

export default { patchMessageRows };
