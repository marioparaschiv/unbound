import { messageTextViewClass } from '@unbound-plugins/shared/native/ios/text-attachments';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { installReuseCleanup } from '@unbound-plugins/shared/native/ios/ui-reuse-cleanup';
import ensureClasses from '@unbound-plugins/shared/native/ios/ensure-classes';
import type { NativePluginBridge } from '@unbound-app/api/native';

import type { Embeds, Renderers } from '~/modules';
import { subscribeMessageStore } from '~/ios/message-sync';
import { hookMessageCells } from '~/ios/cells';
import { createSession } from '~/ios/session';
import { mediaPatches } from '~/patches/media';
import { EMBED_HOST_TAG } from '~/constants';

/**
 * @description Embeds linked messages into iOS message cells.
 * @param native The plugin's native bridge.
 * @param renderers Discord's message renderers.
 * @returns How many embeds are drawn and `dispose`, or `undefined` when a class or the embed surface is missing.
 */
export function startEmbeds(native: NativePluginBridge, renderers: Renderers): Embeds | undefined {
	const { objc, fabric, ui } = native;

	if (
		!ensureClasses('Message Link Embeds', objc, [
			'DCDMessageTableViewCell',
			messageTextViewClass(objc),
		])
	) {
		return;
	}

	const embeds = createSession(objc, fabric, renderers);

	if (!embeds) {
		console.error('[Message Link Embeds] Skipped, the embed surface did not register.');

		return;
	}

	const { session } = embeds;

	return {
		drawn: embeds.drawn,
		dispose: applyFeatures('Message Link Embeds', [
			() => embeds.dispose,
			...mediaPatches,
			() => subscribeMessageStore(session),
			() => hookMessageCells(session),
			() => {
				const scope = ui.createScope();

				ui.run(installReuseCleanup, scope, {
					cellClass: 'DCDMessageTableViewCell',
					tag: EMBED_HOST_TAG,
					label: 'Message Link Embeds',
				});

				return () => scope.dispose();
			},
		]),
	};
}
