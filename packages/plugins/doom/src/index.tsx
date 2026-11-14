import { commands } from '@unbound-app/api';

import { openDoom } from '~/game';

export function start() {
	commands.register({
		doom: {
			description: 'DOOM_DESC',
			execute: () => {
				openDoom();
			},
		},
	});
}

export function stop() {}

export { SettingsPanel } from '~/settings';
