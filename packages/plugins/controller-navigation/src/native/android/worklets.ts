import {
	javaBoolean,
	javaNumber,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaValue,
	NativeUICallback,
	NativeUIScope,
} from '@unbound-app/api/native';

import { GAMEPAD_SOURCES, KEY_ACTIONS } from '~/lib/keys';

const ACTION_DOWN = 0;

type KeyEventCall = { args: NativeJavaValue[] };

/**
 * @description Takes a game controller's D-pad and buttons before Discord sees them: each handled key is consumed, and
 * its first press is handed to JavaScript. Hooks `dispatchKeyEvent` on Discord's activities; other keys go through.
 * @param scope The plugin's UI scope, which removes the hook on dispose.
 * @param onPress Receives the pressed key code on the JavaScript thread.
 */
export function installControllerHook(scope: NativeUIScope, onPress: NativeUICallback<[number]>) {
	'worklet';
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const java = scope.java as NativeJavaBridge;

	hooks.hook(
		'android.app.Activity',
		'dispatchKeyEvent',
		['android.view.KeyEvent'],
		{ rewriteResult: true, subclasses: true, payload: { receiver: false } },
		(event: KeyEventCall) => {
			const key = javaReference(event.args[0]);

			if (!key) return undefined;

			const code = javaNumber(java.invoke(key, 'getKeyCode', [])) ?? 0;
			const source = javaNumber(java.invoke(key, 'getSource', [])) ?? 0;

			if (!(code in KEY_ACTIONS) || (source & GAMEPAD_SOURCES) === 0) return undefined;

			const down = javaNumber(java.invoke(key, 'getAction', [])) === ACTION_DOWN;
			const repeat = javaNumber(java.invoke(key, 'getRepeatCount', [])) ?? 0;

			if (down && repeat === 0) onPress(code);

			return { result: javaBoolean(true) };
		},
	);
}
