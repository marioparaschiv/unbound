import type { NativeBridge, NativeJavaHandle, NativeJavaProxy } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';

import { javaFloat, javaInt, javaString } from '@unbound-plugins/shared/native/android/java-values';
import { currentActivity } from '@unbound-plugins/shared/native/android/views';

import { speechRate } from '~/lib/rates';

const QUEUE_ADD = 1;
const SUCCESS = 0;
const UTTERANCE_ID = 'unbound-vc-narrator';

/**
 * @description Speaks through Android's `TextToSpeech`, created on the first line and queueing lines until its engine is ready.
 * @param native The plugin's native bridge.
 * @returns `speak`, which queues a line, and `dispose`, which stops speaking and shuts the engine down.
 */
export function speechAndroid(native: NativeBridge) {
	const { java, hooks } = native;
	const pending: string[] = [];
	let engine: NativeJavaHandle | undefined;
	let listener: NativeJavaProxy | undefined;
	let ready = false;

	function say(text: string) {
		java.invoke(engine!, 'setSpeechRate', [
			javaFloat(speechRate(settings.voice.rate, 'android')),
		]);
		java.invoke(engine!, 'speak', [
			javaString(text),
			javaInt(QUEUE_ADD),
			{ type: 'null', class: 'android.os.Bundle' },
			javaString(UTTERANCE_ID),
		]);
	}

	function create() {
		const activity = currentActivity(java);

		if (!activity) return;

		listener = hooks.proxy(['android.speech.tts.TextToSpeech$OnInitListener'], (call) => {
			ready = Number(call.args[0]) === SUCCESS;

			for (const text of pending.splice(0)) if (ready) say(text);
		});
		engine = java.construct('android.speech.tts.TextToSpeech', [activity, listener.object]);
	}

	return {
		speak(text: string) {
			if (!engine) create();
			if (!engine) return;
			if (!ready) {
				pending.push(text);

				return;
			}

			say(text);
		},
		dispose() {
			if (engine) {
				java.invoke(engine, 'stop', []);
				java.invoke(engine, 'shutdown', []);
			}

			if (listener) hooks.remove(listener.token);

			engine = undefined;
			listener = undefined;
			ready = false;
			pending.length = 0;
		},
	};
}
