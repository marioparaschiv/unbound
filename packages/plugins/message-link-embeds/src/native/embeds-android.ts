import { createSurfaceListeners } from '@unbound-plugins/shared/native/surface-listeners';
import type { NativePluginBridge } from '@unbound-app/api/native';
import {
	createMessageTextSurfaces,
	type TextSurfaceSlot,
} from '@unbound-plugins/shared/native/android/message-text-surfaces';

import { registerMessageSurface, type SurfaceContent } from '~/components/message-surface';
import {
	findRenderedLinkRange,
	linkedTargets,
	targetKey,
	type LinkTarget,
} from '~/lib/link-targets';
import { MessageStore, type Embeds, type Renderers } from '~/lib/modules';
import { buildEmbeddedContent } from '~/lib/embedded-content';
import { createLinkedMessages } from '~/lib/linked-messages';
import { selectedChannelId } from '@unbound-plugins/shared/metro/selected-channel';

import { linkedChannelName } from '~/lib/channels';
import { Surface } from '~/lib/constants';

const INSERTION = '\n\ufffc';

type Embed = SurfaceContent & {
	target: LinkTarget;
	revision: number;
};

type EmbedSlot = TextSurfaceSlot & {
	target: LinkTarget;
	content: Omit<SurfaceContent, 'width'>;
};

/**
 * @description Embeds the message each Android message links to as a real chat row through the loader's native text rewrites, so embeds stay in place while the chat scrolls.
 * @param native The plugin's native bridge.
 * @param renderers Discord's message renderers, shared with the iOS embeds.
 * @returns `drawn` and `dispose`, which removes every embed and restores the text, or `undefined` when the surface or the native rewrites are unavailable.
 */
export function drawAndroidEmbeds(
	native: NativePluginBridge,
	renderers: Renderers,
): Embeds | undefined {
	const bySurface = new Map<string, Embed>();
	const heights = new Map<string, number>();
	const listeners = createSurfaceListeners();
	const waiting = new Map<string, Set<() => void>>();
	const controller = new AbortController();

	const linked = createLinkedMessages(controller.signal, (key) => {
		for (const retry of waiting.get(key) ?? []) retry();

		waiting.delete(key);
	});

	const surfaceModule = registerMessageSurface({
		renderers,
		surface: (surfaceId) => bySurface.get(surfaceId),
		reportLayout: (surfaceId, height) => reportLayout(surfaceId, height),
		revision: (surfaceId) => bySurface.get(surfaceId)?.revision ?? -1,
		subscribe: listeners.subscribe,
	});

	if (!surfaceModule) {
		logger.warn('Embeds skipped: the embed surface did not register.');
		return;
	}

	const surfaces = createMessageTextSurfaces<EmbedSlot>(native, {
		surfaceModule,
		prefix: 'message-link-android',
		async slots(text) {
			const messageId = await text.messageId();
			const channelId = selectedChannelId();
			const source =
				channelId && messageId ? MessageStore.getMessage(channelId, messageId) : undefined;
			const [target] = source ? linkedTargets(source) : [];

			if (!target) return;

			const linkedMessage = linked.get(target);

			if (!linkedMessage) {
				const retries = waiting.get(targetKey(target)) ?? new Set();

				retries.add(text.retry);
				waiting.set(targetKey(target), retries);
				linked.fetch(target);

				return;
			}

			const channelName = linkedChannelName(target, linkedMessage);
			const range = channelName ? findRenderedLinkRange(text.string, channelName) : undefined;
			const content = buildEmbeddedContent(renderers, linkedMessage, target.channelId);

			if (!range || !content) return;

			const insertAt = range.location + range.length;

			return [
				{
					start: insertAt,
					end: insertAt,
					text: INSERTION,
					placeholder: 1,
					gap: Surface.topGap,
					target,
					content,
				},
			];
		},
		async layout(surfaceId, slot, width) {
			const previous = bySurface.get(surfaceId);

			bySurface.set(surfaceId, {
				...slot.content,
				width,
				target: slot.target,
				revision: (previous?.revision ?? 0) + 1,
			});
			listeners.notify(surfaceId);

			return heights.get(targetKey(slot.target)) ?? Surface.minHeight;
		},
	});

	if (!surfaces) {
		logger.warn('Embeds skipped: the native text rewrites are unavailable.');
		return;
	}

	const drawing = surfaces;

	function reportLayout(surfaceId: string, height: number) {
		const embed = bySurface.get(surfaceId);

		if (!embed || !Number.isFinite(height) || height <= 0 || height > Surface.maxHeight) {
			return;
		}

		const fitted = Math.max(Surface.minHeight, height - Surface.bottomTrim);
		const key = targetKey(embed.target);

		if (Math.abs(fitted - (heights.get(key) ?? Surface.minHeight)) < 2) return;

		heights.set(key, fitted);
		drawing.redraw(surfaceId);
	}

	return {
		drawn: drawing.drawn,
		dispose() {
			controller.abort();
			waiting.clear();
			bySurface.clear();
			listeners.clear();

			return drawing.dispose();
		},
	};
}

export default { drawAndroidEmbeds };
