import { messageTextViewClass } from '@unbound-plugins/shared/native/ios/text-attachments';
import { skipFeature, startTogether } from '@unbound-plugins/shared/lifecycle/features';
import { installReuseCleanup } from '@unbound-plugins/shared/native/ios/ui-reuse-cleanup';
import ensureClasses from '@unbound-plugins/shared/native/ios/ensure-classes';
import type { NativePluginBridge } from '@unbound-app/api/native';

import type { Embeds, Renderers } from '~/embeds/modules';
import { subscribeMessageStore } from '~/embeds/ios/message-sync';
import { hookMessageCells } from '~/embeds/ios/cells';
import { createSession } from '~/embeds/ios/session';
import { EMBED_HOST_TAG } from '~/constants';

/**
 * @description Embeds linked messages into iOS message cells.
 * @param native The plugin's native bridge.
 * @param renderers Discord's message renderers.
 * @returns How many embeds are drawn and `dispose`, or `undefined` when a class or the embed surface is missing.
 */
export function startEmbeds(native: NativePluginBridge, renderers: Renderers): Embeds | undefined {
	const { objc, fabric, ui } = native;

	if (!ensureClasses(objc, ['DCDMessageTableViewCell', messageTextViewClass(objc)])) {
		return;
	}

	const embeds = createSession(objc, fabric, renderers);

	if (!embeds) {
		skipFeature('the embed surface did not register');

		return;
	}

	const { session } = embeds;

	return {
		drawn: embeds.drawn,
		dispose: startTogether([
			() => embeds.dispose,
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
