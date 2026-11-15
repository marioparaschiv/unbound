import type { NativeBridge, PluginContext } from '@unbound-app/api/native';
import { metro, patcher, toasts } from '@unbound-app/api';
import type { AnyProps } from '@unbound-app/api/metro';
import { messages } from '@unbound-app/i18n';

import { readableImage, type ShareSource } from '~/lib/image-url';
import { recognizeText } from '~/native/recognize';
import { openTextPage } from '~/text-page';

type ShareAction = { IconComponent: unknown; label: string; action: () => void };

const Icons = metro.findByProps('TextIcon', { lazy: true });

let stopWaiting: (() => void) | undefined;

async function readImage(bridge: NativeBridge, url: string) {
	try {
		const lines = await recognizeText(bridge, url);

		if (!lines.length) {
			toasts.show({ title: addon.name, content: messages.NO_TEXT });

			return;
		}

		openTextPage(lines);
	} catch (error) {
		logger.error(`Failed to read the text in image ${url}:`, error);
		toasts.show({ title: addon.name, content: messages.READ_FAILED });
	}
}

export function start(context: PluginContext) {
	stopWaiting = metro.onModuleLoaded(
		metro.filters.byFilePath('modules/media_viewer/native/components/MediaShareActions.tsx'),
		(module: AnyProps) => {
			if (typeof module.useMediaShareActions !== 'function') {
				logger.warn('Live Text skipped: Discord moved useMediaShareActions.');

				return;
			}

			patcher.after(module, 'useMediaShareActions', ({ args: [props], result }) => {
				const url = readableImage((props as { source?: ShareSource } | undefined)?.source);

				if (!url || !Array.isArray(result)) return result;

				const read: ShareAction = {
					IconComponent: Icons?.TextIcon,
					label: messages.COPY_TEXT,
					action: () => void readImage(context.native, url),
				};

				return [...(result as ShareAction[]), read];
			});
		},
		{ interop: false },
	);
}

export function stop() {
	stopWaiting?.();
	stopWaiting = undefined;
	patcher.unpatchAll();
}
