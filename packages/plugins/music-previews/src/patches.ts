import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { metro, patcher } from '@unbound-app/api';

import PreviewSheet from '~/components/preview-sheet';
import { stopPreview } from '~/lib/player';
import { parseMusicLink } from '~/lib/music-link';

const SHEET_KEY = 'music-previews';

/**
 * @description Opens a preview sheet for Spotify and Apple Music links instead of leaving Discord, by patching Discord's
 * `handleURL`, which tapped links reach after Discord's own checks. Opening the link from the sheet runs the original.
 */
export function patchMusicLinks(): void {
	const HandleURL = metro.findByFilePath('modules/links/native/handleURL.tsx');

	if (typeof HandleURL?.default !== 'function') {
		logger.warn('Music previews skipped: Discord moved handleURL.');

		return;
	}

	patcher.instead(HandleURL, 'default', ({ args, original, this: self }) => {
		const [url] = args as [unknown];
		const link = typeof url === 'string' ? parseMusicLink(url) : undefined;

		if (!link) return original.apply(self, args);

		openSheet(SHEET_KEY, PreviewSheet, {
			link,
			openLink: () => void original.apply(self, args),
		});

		return Promise.resolve(true);
	});
}

/**
 * @description Stops the preview that is playing and closes the sheet.
 */
export function stopPreviews(): void {
	stopPreview();
	metro.api.ActionSheets?.hideActionSheet(SHEET_KEY);
}
