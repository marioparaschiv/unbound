import { patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { copyWith, dearrowMessage, messageVideoIds, type Message } from '~/embeds/message-embeds';
import type { PendingRows } from '~/embeds/redraw';
import type { BrandingLookup } from '~/embeds/lookup';
import { MessageRowData } from '~/embeds/modules';
import type { Toggles } from '~/embeds/toggles';

type RowMessage = Message & {
	channel_id?: unknown;
};

type RowInput = {
	message?: RowMessage | null;
};

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
	const unpatch = patcher.before(MessageRowData, 'generateMessageRowData', ({ args }) => {
		const [input, ...rest] = args as [RowInput | undefined, ...unknown[]];
		const message = input?.message;
		const mode = settings.replaceElements;
		const loading = messageVideoIds(message).filter((id) => lookup.get(id) === undefined);

		if (loading.length) pending.track(loading, message?.channel_id, message?.id);

		const dearrowed = dearrowMessage(message, lookup.get, mode);

		if (!input || !dearrowed || !toggles.isDearrowed(message?.id)) return;

		return [copyWith(input, { message: dearrowed }), ...rest];
	});

	return () => {
		unpatch();
		pending.clear();
		pending.rebindAll();
	};
}
