import { metro, patcher } from '@unbound-app/api';

/**
 * @description Lets you jump to messages from blocked or ignored users and likely spammers without the unblock prompt.
 * Patches the default export of Discord's `validateJumpWithAlert`.
 */
export function patchJumpCheck(): void {
	const JumpCheck = metro.findByFilePath('modules/messages/validateJumpWithAlert.tsx');

	if (typeof JumpCheck?.default !== 'function') {
		logger.warn('Jumping to blocked messages skipped: Discord moved validateJumpWithAlert.');

		return;
	}

	patcher.instead(JumpCheck, 'default', () => true);
}
