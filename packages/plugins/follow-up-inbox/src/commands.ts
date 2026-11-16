import { commands } from '@unbound-app/api';

import { openFollowUps } from '~/lib/sheet';

/**
 * @description Adds `/follow-ups`, which opens the follow-ups list.
 */
export function registerFollowUps(): void {
	commands.register({
		'follow-ups': {
			description: 'COMMAND_DESC',
			execute: () => {
				openFollowUps();
			},
		},
	});
}

export default { registerFollowUps };
