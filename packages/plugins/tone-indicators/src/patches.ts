import { mapTextNodes, type ContentNode } from '@unbound-plugins/shared/metro/content-nodes';
import {
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import { settings } from '@unbound-app/settings';

import { customTones } from '~/lib/tones';
import { splitTones } from '~/lib/pills';

type ContentRow = MessageRow & { content?: ContentNode[] };

/**
 * @description Turns tone tags in every message into Discord's timestamp pills that spell out what they mean.
 * Rewrites the content of each row `generateMessageRowData` builds.
 */
export function patchMessageRows(): void {
	onMessageRow<RowMessage, ContentRow>({
		feature: 'Tone indicators',
		after({ row }) {
			if (!Array.isArray(row?.content)) return;

			const custom = customTones(settings.custom);

			row.content = mapTextNodes(row.content, (text) =>
				splitTones(text, custom, settings.explain),
			);
		},
	});
}

export default { patchMessageRows };
