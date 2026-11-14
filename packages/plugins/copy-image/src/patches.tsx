import type { NativeBridge } from '@unbound-app/api/native';
import { metro, patcher, toasts } from '@unbound-app/api';
import type { AnyProps } from '@unbound-app/api/metro';
import { messages } from '@unbound-app/i18n';

import { copyableImage, type ShareSource } from '~/lib/share-source';
import { toBase64 } from '~/lib/base64';
import { pngUrl } from '~/lib/png-url';
import { copyPng } from '~/native/copy';

type ShareAction = { IconComponent: unknown; label: string; action: () => void };

const Icons = metro.findByProps('CopyIcon', { lazy: true });

async function copyImage(bridge: NativeBridge, url: string) {
	try {
		const response = await fetch(pngUrl(url));

		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const copied = await copyPng(bridge, toBase64(await response.arrayBuffer()));

		toasts.show({
			title: addon.name,
			content: copied ? messages.IMAGE_COPIED : messages.COPY_FAILED,
		});
	} catch (error) {
		logger.error(`Failed to copy image ${url}:`, error);
		toasts.show({ title: addon.name, content: messages.COPY_FAILED });
	}
}

/**
 * @description Adds Copy Image after the media viewer's share items for pictures, by patching `useMediaShareActions`.
 * @param bridge The plugin's native bridge, which writes the clipboard.
 * @returns A function that stops waiting for the module when it has not loaded yet.
 */
export function patchShareActions(bridge: NativeBridge): () => void {
	return metro.onModuleLoaded(
		metro.filters.byFilePath('modules/media_viewer/native/components/MediaShareActions.tsx'),
		(module: AnyProps) => {
			if (typeof module.useMediaShareActions !== 'function') {
				logger.warn('Copy Image skipped: Discord moved useMediaShareActions.');

				return;
			}

			patcher.after(module, 'useMediaShareActions', ({ args: [props], result }) => {
				const url = copyableImage((props as { source?: ShareSource } | undefined)?.source);

				if (!url || !Array.isArray(result)) return result;

				const copy: ShareAction = {
					IconComponent: Icons?.CopyIcon,
					label: messages.COPY_IMAGE,
					action: () => void copyImage(bridge, url),
				};

				return [...(result as ShareAction[]), copy];
			});
		},
		{ interop: false },
	);
}

export default patchShareActions;
