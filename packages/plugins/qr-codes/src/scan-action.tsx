import type { NativeBridge } from '@unbound-app/api/native';
import { metro, patcher, toasts } from '@unbound-app/api';
import type { AnyProps } from '@unbound-app/api/metro';
import { messages } from '@unbound-app/i18n';
import { Linking } from 'react-native';

import { isWebLink, scannableImage, type ShareSource } from '~/lib/share-source';
import { scanQrCode } from '~/native/scan';

type ShareAction = { IconComponent: unknown; label: string; action: () => void };
type Clipboard = { setString(text: string): void };

const Icons = metro.findByProps('QrCodeIcon', { lazy: true });
const Clipboard: Clipboard | undefined = metro.findByProps('setString', 'getString', {
	lazy: true,
});

function show(content: string) {
	toasts.show({ title: addon.name, content });
}

async function scanImage(bridge: NativeBridge, url: string) {
	try {
		const text = await scanQrCode(bridge, url);

		if (!text) return show(messages.NO_QR_CODE);

		if (isWebLink(text)) {
			await Linking.openURL(text.trim());

			return;
		}

		Clipboard?.setString(text);
		show(messages.QR_TEXT_COPIED);
	} catch (error) {
		logger.error(`Failed to scan image ${url} for a QR code:`, error);
		show(messages.SCAN_FAILED);
	}
}

/**
 * @description Adds Scan QR Code after the media viewer's share items for pictures, by patching `useMediaShareActions`.
 * @param bridge The plugin's native bridge, which reads the code.
 * @returns A function that stops waiting for the module when it has not loaded yet.
 */
export function patchScanAction(bridge: NativeBridge): () => void {
	return metro.onModuleLoaded(
		metro.filters.byFilePath('modules/media_viewer/native/components/MediaShareActions.tsx'),
		(module: AnyProps) => {
			if (typeof module.useMediaShareActions !== 'function') {
				logger.warn('QR code scanning skipped: Discord moved useMediaShareActions.');

				return;
			}

			patcher.after(module, 'useMediaShareActions', ({ args: [props], result }) => {
				const url = scannableImage((props as { source?: ShareSource } | undefined)?.source);

				if (!url || !Array.isArray(result)) return result;

				const scan: ShareAction = {
					IconComponent: Icons?.QrCodeIcon,
					label: messages.SCAN_QR_CODE,
					action: () => void scanImage(bridge, url),
				};

				return [...(result as ShareAction[]), scan];
			});
		},
		{ interop: false },
	);
}

export default patchScanAction;
