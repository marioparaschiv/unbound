import { patcher } from '@unbound-app/api';

import { copyWith, dearrowMessage, messageVideoIds, type Message } from '~/embeds';
import { MessageRowData, settings } from '~/modules';
import type { PendingRows } from '~/redraw';
import { toReplaceMode } from '~/preferences';
import type { BrandingLookup } from '~/lookup';
import type { Toggles } from '~/toggles';
import { SETTINGS } from '~/constants';

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
		const mode = toReplaceMode(settings.get('replaceElements', SETTINGS.replaceElements));
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
