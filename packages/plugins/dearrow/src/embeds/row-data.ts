import { onMessageRow, type RowMessage } from '@unbound-plugins/shared/metro/message-rows';
import { settings } from '@unbound-app/settings';

import { copyWith, dearrowMessage, messageVideoIds, type Message } from '~/embeds/message-embeds';
import type { PendingRows } from '~/embeds/redraw';
import type { BrandingLookup } from '~/embeds/lookup';
import type { Toggles } from '~/embeds/toggles';

/**
 * @description Shows DeArrow titles and thumbnails on YouTube embeds as Discord builds each chat row, and fetches branding for embeds it has not seen.
 * @param lookup The cached DeArrow branding.
 * @param toggles The messages the user switched between dearrowed and original.
 * @param pending The rows waiting for branding that is still loading.
 * @returns A function that removes the patch and redraws the chat with the original embeds.
 */
export function patchMessageRowData(
	lookup: BrandingLookup,
	toggles: Toggles,
	pending: PendingRows,
): () => void {
	const unpatch = onMessageRow<RowMessage & Message>({
		before({ input, message }) {
			const mode = settings.replaceElements;
			const loading = messageVideoIds(message).filter((id) => lookup.get(id) === undefined);

			if (loading.length) pending.track(loading, message?.channel_id, message?.id);

			const dearrowed = dearrowMessage(message, lookup.get, mode);

			if (!input || !dearrowed || !toggles.isDearrowed(message?.id)) return;

			return { input: copyWith(input, { message: dearrowed }) };
		},
	});

	return () => {
		unpatch();
		pending.clear();
		pending.rebindAll();
	};
}
