import type { BuiltInData } from '@typings/built-ins';
import { findByProps, findStore } from '@api/metro';
import { Dispatcher } from '@api/metro/common';
import { createPatcher } from '@patcher';


const Patcher = createPatcher('unbound::connecting_fix');

export const data: BuiltInData = {
	name: 'Connecting Fix'
};

export function start() {
	const AuthenticationUtilities = findByProps('startSession', { lazy: true });
	const AuthenticationStore = findStore('Authentication');

	Patcher.after(AuthenticationUtilities, 'startSession', () => {
		setTimeout(() => {
			if (!AuthenticationStore.getSessionId()) {
				// Borrowed from @octet-stream <@263530950070239235>
				// Reference image https://i.imgur.com/P5Rk5hu.png
				Dispatcher.dispatch({ type: 'APP_STATE_UPDATE', state: 'inactive' });
				Dispatcher.dispatch({ type: 'APP_STATE_UPDATE', state: 'background' });
				Dispatcher.dispatch({ type: 'APP_STATE_UPDATE', state: 'active' });
			}
		}, 300);
	}, true);
}

export function stop() {
	Patcher.unpatchAll();
}
