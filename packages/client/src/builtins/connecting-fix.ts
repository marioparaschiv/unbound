import { createPatcher } from 'possess';

import { findByProps, findStore } from '~/api/metro';
import { Dispatcher } from '~/api/metro/common';

const Patcher = createPatcher('unbound::connecting-fix');

export function start() {
	const AuthenticationUtilities = findByProps('startSession', { lazy: true });
	const AuthenticationStore = findStore('Authentication');

	Patcher.after(
		AuthenticationUtilities,
		'startSession',
		() => {
			setTimeout(() => {
				if (AuthenticationStore.getSessionId()) return;

				// Borrowed from @octet-stream <@263530950070239235>
				// Reference image https://i.imgurunbound.com/P5Rk5hu.png
				Dispatcher.dispatch({ type: 'APP_STATE_UPDATE', state: 'inactive' });
				Dispatcher.dispatch({ type: 'APP_STATE_UPDATE', state: 'background' });
				Dispatcher.dispatch({ type: 'APP_STATE_UPDATE', state: 'active' });
			}, 250);
		},
		{ once: true },
	);
}

export function stop() {
	Patcher.unpatchAll();
}

// TEMP: disabled to test whether its synthetic APP_STATE_UPDATE dispatches disrupt the debugger.
export function shouldStart() {
	return false;
}

export default { start, stop, shouldStart };
