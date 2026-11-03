import { patcher } from '@unbound-app/api';

import { copyWith, dearrowMessage, type Message } from '~/embeds';
import { MessageRowData, settings } from '~/modules';
import { redrawMessages } from '~/redraw';
import { toReplaceMode } from '~/preferences';
import type { BrandingLookup } from '~/lookup';
import type { Toggles } from '~/toggles';
import { SETTINGS } from '~/constants';

type RowInput = {
	message?: Message | null;
};

/**
 * @description Shows DeArrow titles and thumbnails on YouTube embeds as Discord builds each chat row, and fetches branding for embeds it has not seen.
 * @param lookup The cached DeArrow branding.
 * @param toggles The messages the user switched between dearrowed and original.
 * @returns A function that removes the patch and redraws the chat with the original embeds.
 */
export function patchMessageRowData(lookup: BrandingLookup, toggles: Toggles): () => void {
	const unpatch = patcher.before(MessageRowData, 'generateMessageRowData', ({ args }) => {
		const [input, ...rest] = args as [RowInput | undefined, ...unknown[]];
		const message = input?.message;
		const mode = toReplaceMode(settings.get('replaceElements', SETTINGS.replaceElements));
		const dearrowed = dearrowMessage(message, lookup.get, mode);

		if (!input || !dearrowed || !toggles.isDearrowed(message?.id)) return;

		return [copyWith(input, { message: dearrowed }), ...rest];
	});

	return () => {
		unpatch();
		redrawMessages();
	};
}
