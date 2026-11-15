import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeUICallback,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaBoolean,
	javaFlag,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';

const READ_ONLY = 0x10000000;
const PCM_16BIT = 2;
const RESULTS = 'results_recognition';

/**
 * @description Starts Android's speech recognizer on a raw PCM file, on the main thread as it requires, and reports
 * the first result or the error code through the callback.
 * @param scope The plugin's UI scope, which removes the listener on dispose.
 * @param path The PCM file's path.
 * @param sampleRate The PCM's sample rate.
 * @param channels The PCM's channel count.
 * @param report Called once with the text, or with an empty text and the error code.
 */
export function startRecognition(
	scope: NativeUIScope,
	path: string,
	sampleRate: number,
	channels: number,
	report: NativeUICallback<[string, number]>,
) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const app = javaReference(
		java.invoke(java.getClass('android.app.ActivityThread'), 'currentApplication', []),
	);
	const Recognizer = java.getClass('android.speech.SpeechRecognizer');

	if (!app || !javaFlag(java.invoke(Recognizer, 'isRecognitionAvailable', [app]))) {
		report('', -1);

		return;
	}

	const onDevice = javaFlag(java.invoke(Recognizer, 'isOnDeviceRecognitionAvailable', [app]));
	const recognizer = javaReference(
		java.invoke(
			Recognizer,
			onDevice ? 'createOnDeviceSpeechRecognizer' : 'createSpeechRecognizer',
			[app],
		),
	)!;
	const file = java.construct('java.io.File', [javaString(path)]);
	const descriptor = javaReference(
		java.invoke(java.getClass('android.os.ParcelFileDescriptor'), 'open', [
			file,
			javaInt(READ_ONLY),
		]),
	)!;
	const intent = java.construct('android.content.Intent', [
		javaString('android.speech.action.RECOGNIZE_SPEECH'),
	]);
	const put = (key: string, value: unknown) =>
		java.invoke(intent, 'putExtra', [
			javaString(`android.speech.extra.${key}`),
			value as never,
		]);
	let done = false;
	let latest = '';

	put('LANGUAGE_MODEL', javaString('free_form'));
	put('AUDIO_SOURCE', descriptor);
	put('AUDIO_SOURCE_ENCODING', javaInt(PCM_16BIT));
	put('AUDIO_SOURCE_SAMPLING_RATE', javaInt(sampleRate));
	put('AUDIO_SOURCE_CHANNEL_COUNT', javaInt(channels));
	put('PREFER_OFFLINE', javaBoolean(true));
	put('PARTIAL_RESULTS', javaBoolean(true));

	const finish = (text: string, code: number) => {
		if (done) return;

		done = true;
		report(text, code);
		java.invoke(recognizer, 'destroy', []);
	};
	const firstResult = (bundleValue: unknown): string => {
		const bundle = javaReference(bundleValue as never);
		const list = bundle
			? javaReference(java.invoke(bundle, 'getStringArrayList', [javaString(RESULTS)]))
			: null;
		const size = list ? (javaNumber(java.invoke(list, 'size', [])) ?? 0) : 0;

		return list && size > 0 ? (javaText(java.invoke(list, 'get', [javaInt(0)])) ?? '') : '';
	};
	const listener = hooks.proxy(['android.speech.RecognitionListener'], (call) => {
		try {
			if (call.method === 'onPartialResults') {
				latest = firstResult(call.args[0]) || latest;
			} else if (call.method === 'onError') {
				if (latest) finish(latest, 0);
				else finish('', javaNumber(call.args[0]) ?? -2);
			} else if (call.method === 'onResults') {
				finish(firstResult(call.args[0]) || latest, 0);
			}
		} catch (error) {
			console.error(
				`[Voice Transcripts] Failed to read a recognition result: ${String(error)}`,
			);
			finish(latest, latest ? 0 : -2);
		}
	});

	java.invoke(recognizer, 'setRecognitionListener', [listener.object]);
	java.invoke(recognizer, 'startListening', [intent]);
}
