import { metro, patcher } from '@unbound-app/api';

/**
 * @description Stops Discord from treating any message or author as spam, so messages from likely spammers stay visible.
 * Patches `isSpam` and `isSpammer` in Discord's spam message helpers.
 */
export function patchSpamCheck(): void {
	const SpamCheck = metro.findByFilePath('modules/messages/isSpam.tsx');

	if (typeof SpamCheck?.isSpam !== 'function' || typeof SpamCheck.isSpammer !== 'function') {
		logger.warn('Spam messages skipped: Discord moved isSpam.');

		return;
	}

	patcher.instead(SpamCheck, 'isSpam', () => false);
	patcher.instead(SpamCheck, 'isSpammer', () => false);
}
