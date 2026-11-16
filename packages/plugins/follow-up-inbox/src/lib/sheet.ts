import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';

import FollowUpsSheet from '~/components/follow-ups-sheet';

/**
 * @description Opens the follow-ups list.
 */
export function openFollowUps(): void {
	openSheet('unbound-follow-up-inbox', FollowUpsSheet, {});
}

export default { openFollowUps };
