import { messageTextViewClass } from '@unbound-plugins/shared/native/ios/text-attachments';
import { installReuseCleanup } from '@unbound-plugins/shared/native/ios/ui-reuse-cleanup';
import ensureClasses from '@unbound-plugins/shared/native/ios/ensure-classes';
import type { NativeBridge } from '@unbound-app/api/native';

import type { Embeds, Renderers } from '~/lib/modules';
import { subscribeMessageStore } from '~/native/message-sync-ios';
import { hookMessageCells } from '~/native/cells-ios';
import { createSession } from '~/native/session-ios';
import { EMBED_HOST_TAG } from '~/lib/constants';

/**
 * @description Embeds linked messages into iOS message cells. The Addon scope removes the store listener, timers, cell hooks and UI-thread scope.
 * @param native The plugin's native bridge.
 * @param renderers Discord's message renderers.
 * @returns How many embeds are drawn and `dispose`, or `undefined` when a class or the embed surface is missing.
 */
export function drawIOSEmbeds(native: NativeBridge, renderers: Renderers): Embeds | undefined {
	const { objc, fabric, ui } = native;

	if (!ensureClasses(objc, ['DCDMessageTableViewCell', messageTextViewClass(objc)], 'Embeds')) {
		return;
	}

	const embeds = createSession(objc, fabric, renderers);

	if (!embeds) {
		logger.warn('Embeds skipped: the embed surface did not register.');
		return;
	}

	subscribeMessageStore(embeds.session);
	hookMessageCells(embeds.session);
	ui.run(installReuseCleanup, ui.createScope(), {
		cellClass: 'DCDMessageTableViewCell',
		tag: EMBED_HOST_TAG,
		label: 'Message Link Embeds',
	});

	return { drawn: embeds.drawn, dispose: async () => embeds.dispose() };
}
