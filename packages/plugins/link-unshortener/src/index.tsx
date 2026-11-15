import { metro, patcher, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { sheetLink, withOption, type LinkSheetProps } from '~/lib/sheet';
import { isShortLink, resolveLink } from '~/lib/shorteners';
import { openLinkPage } from '~/link-page';

const LINK_SHEET = 'LongPressUrl';

async function unshorten(link: string) {
	try {
		openLinkPage(await resolveLink(link));
	} catch (error) {
		logger.error(`Failed to follow short link ${link}:`, error);
		toasts.show({ title: addon.name, content: messages.FAILED });
	}
}

export function start() {
	const { ActionSheets } = metro.api;

	if (!ActionSheets?.openLazy) {
		logger.warn('Link unshortener skipped: Discord moved ActionSheets.openLazy.');

		return;
	}

	patcher.before(ActionSheets, 'openLazy', ({ args }) => {
		if (args[1] !== LINK_SHEET) return;

		const props = args[2] as LinkSheetProps | undefined;
		const link = sheetLink(props);

		if (!props || !link || !isShortLink(link)) return;

		args[2] = withOption(props, {
			label: messages.UNSHORTEN,
			onPress: () => {
				ActionSheets.hideActionSheet?.();
				void unshorten(link);
			},
		});
	});
}

export function stop() {
	patcher.unpatchAll();
}
