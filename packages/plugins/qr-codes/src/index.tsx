import { metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { sheetLink, withOption, type LinkSheetProps } from '~/lib/sheet';
import { openQrPage } from '~/qr-page';

const LINK_SHEET = 'LongPressUrl';

export function start() {
	const { ActionSheets } = metro.api;

	if (!ActionSheets?.openLazy) {
		logger.warn('QR codes skipped: Discord moved ActionSheets.openLazy.');

		return;
	}

	patcher.before(ActionSheets, 'openLazy', ({ args }) => {
		if (args[1] !== LINK_SHEET) return;

		const props = args[2] as LinkSheetProps | undefined;
		const link = sheetLink(props);

		if (!props || !link) return;

		args[2] = withOption(props, {
			label: messages.SHOW_QR_CODE,
			onPress: () => {
				ActionSheets.hideActionSheet?.();
				openQrPage(link);
			},
		});
	});
}

export function stop() {
	patcher.unpatchAll();
}
