import {
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import { mapTextNodes, type ContentNode } from '@unbound-plugins/shared/metro/content-nodes';
import { metro } from '@unbound-app/api';

import { splitColors } from '~/lib/pills';

type ContentRow = MessageRow & { content?: ContentNode[] };

/**
 * @description Turns colors written in every message into role mention pills tinted with that color.
 * Rewrites the content of each row `generateMessageRowData` builds.
 */
export function patchMessageRows(): void {
	const { processColor } = metro.common.ReactNative;
	const nativeColor = (hex: string) => {
		const color = processColor(hex);

		return typeof color === 'number' ? color : undefined;
	};

	onMessageRow<RowMessage, ContentRow>({
		feature: 'Message colors',
		after({ row }) {
			if (!Array.isArray(row?.content)) return;

			row.content = mapTextNodes(row.content, (text) => splitColors(text, nativeColor));
		},
	});
}

export default { patchMessageRows };
