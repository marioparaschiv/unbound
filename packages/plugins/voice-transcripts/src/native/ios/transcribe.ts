import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

import { declaresUsage } from '@unbound-plugins/shared/native/ios/usage-keys';

import { groupWords, type TimedWord } from '~/lib/segments';
import type { TranscriptResult } from '~/lib/voice';

const SPEECH_KEY = 'NSSpeechRecognitionUsageDescription';
const NOT_DETERMINED = 0;
const AUTHORIZED = 3;

type ObjC = NativeBridge['objc'];

function cls(objc: ObjC, name: string): NativeObjectHandle {
	const handle = objc.getClass(name);

	if (!handle) throw new Error(`no ${name}`);

	return handle as unknown as NativeObjectHandle;
}

function authorization(objc: ObjC): Promise<number> {
	const status = Number(objc.call(cls(objc, 'SFSpeechRecognizer'), 'authorizationStatus'));

	if (status !== NOT_DETERMINED) return Promise.resolve(status);

	return new Promise((resolve) => {
		const block = objc.block({ returnType: 'void', args: ['i64'] }, ((granted: number) =>
			resolve(Number(granted))) as never);

		objc.call(cls(objc, 'SFSpeechRecognizer'), 'requestAuthorization:', block);
	});
}

async function download(objc: ObjC, url: string): Promise<NativeObjectHandle> {
	const response = await fetch(url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const manager = objc.call(cls(objc, 'NSFileManager'), 'defaultManager') as NativeObjectHandle;
	const directory = objc.call(manager, 'temporaryDirectory') as NativeObjectHandle;
	const extension = /\.(\w+)(\?|$)/.exec(url)?.[1] ?? 'ogg';
	const file = objc.call(
		directory,
		'URLByAppendingPathComponent:',
		`unbound-transcript-${Date.now()}.${extension}`,
	) as NativeObjectHandle;

	objc.invoke(objc.data(await response.arrayBuffer()), 'writeToURL:atomically:', [file, true]);

	return file;
}

type BoxedRange = { value?: { location?: number }; location?: number } | null;

function locationOf(raw: unknown): number {
	const boxed = raw as BoxedRange;

	return Number((boxed?.value ?? boxed)?.location ?? 0);
}

function timedWords(objc: ObjC, transcription: NativeObjectHandle, text: string): TimedWord[] {
	const list = objc.invoke(transcription, 'segments', []);
	const segments = (
		Array.isArray(list) ? list : objc.array(list as NativeObjectHandle)
	) as NativeObjectHandle[];
	const starts = segments.map((segment) =>
		locationOf(objc.invoke(segment, 'substringRange', [])),
	);

	return segments.map((segment, index) => ({
		text:
			text.slice(starts[index], starts[index + 1] ?? text.length).trim() ||
			String(objc.invoke(segment, 'substring', [])),
		start: Number(objc.invoke(segment, 'timestamp', [])),
		duration: Number(objc.invoke(segment, 'duration', [])),
	}));
}

function recognize(objc: ObjC, file: NativeObjectHandle): Promise<TranscriptResult> {
	const recognizer = objc.call(
		cls(objc, 'SFSpeechRecognizer'),
		'new',
	) as NativeObjectHandle | null;

	if (!recognizer || !objc.invoke(recognizer, 'isAvailable', []))
		return Promise.resolve({ failure: 'unavailable' });

	const request = objc.create('SFSpeechURLRecognitionRequest', 'initWithURL:', [file]);

	objc.invoke(request, 'setShouldReportPartialResults:', [false]);

	if (objc.invoke(recognizer, 'supportsOnDeviceRecognition', [])) {
		objc.invoke(request, 'setRequiresOnDeviceRecognition:', [true]);
	}

	return new Promise((resolve) => {
		const handler = objc.block({ returnType: 'void', args: ['object', 'object'] }, ((
			result: NativeObjectHandle | null,
			error: NativeObjectHandle | null,
		) => {
			if (error && !result) {
				const detail = String(objc.invoke(error, 'localizedDescription', []));

				resolve(
					/no speech/i.test(detail)
						? { failure: 'no-speech' }
						: { failure: 'failed', detail },
				);

				return;
			}

			if (!result || !objc.invoke(result, 'isFinal', [])) return;

			const transcription = objc.invoke(
				result,
				'bestTranscription',
				[],
			) as NativeObjectHandle;
			const text = String(objc.invoke(transcription, 'formattedString', []) ?? '').trim();

			if (!text) {
				resolve({ failure: 'no-speech' });

				return;
			}

			resolve({
				text,
				segments: groupWords(timedWords(objc, transcription, text)),
				audioPath: String(objc.invoke(file, 'path', [])),
			});
		}) as never);

		objc.invoke(recognizer, 'recognitionTaskWithRequest:resultHandler:', [request, handler]);
	});
}

/**
 * @description Transcribes audio with Apple's speech recognizer, on the device when it can. iOS stops an app that asks
 * for speech recognition without declaring it, so this checks Unbound's install declares it first; Discord does not.
 * @param native The plugin's native bridge.
 * @param url The audio's address.
 * @returns The transcript, or why there is none.
 */
export async function transcribeOnIOS(
	{ objc }: NativeBridge,
	url: string,
): Promise<TranscriptResult> {
	if (!declaresUsage(objc, SPEECH_KEY)) return { failure: 'needs-sideload' };
	if ((await authorization(objc)) !== AUTHORIZED) return { failure: 'not-allowed' };

	return recognize(objc, await download(objc, url));
}

export default transcribeOnIOS;
