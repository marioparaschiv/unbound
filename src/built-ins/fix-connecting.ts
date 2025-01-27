import type { BuiltInData } from '@typings/built-ins';
import { findByProps, findStore } from '@api/metro';
import { createPatcher } from '@patcher';
import { Dispatcher } from '@api/metro/common';

const Patcher = createPatcher('unbound::fix_connecting');
const AuthenticationUtilities = findByProps('startSession', { lazy: true });
const AuthenticationStore = findStore('Authentication');

export const data: BuiltInData = {
	name: 'Fix Connecting'
};

export function start() {
	patchAuthentication();
}

export function stop() {
	Patcher.unpatchAll();
}

function patchAuthentication() {
  Patcher.after(AuthenticationUtilities, 'startSession', () => {
      setTimeout(() => {
          if (!AuthenticationStore.getSessionId()) {
              Dispatcher.dispatch({
                  type: 'APP_STATE_UPDATE',
                  state: 'active'
              })
          }
      }, 300)
  }, true);
}
