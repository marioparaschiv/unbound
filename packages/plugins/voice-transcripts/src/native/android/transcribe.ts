import type { NativeBridge } from '@unbound-app/api/native';

import { decodeToPcm, readCacheFile, writeCacheFile } from '~/native/android/decode';
import { SPEECH_RATE, toMono } from '~/lib/pcm';
import { startRecognition } from '~/native/android/worklets';
import type { TranscriptResult } from '~/lib/voice';
import { toBase64 } from '~/lib/base64';

const NO_MATCH = 7;
const SPEECH_TIMEOUT = 6;
const INSUFFICIENT_PERMISSIONS = 9;

function failureFor(code: number): TranscriptResult {
	if (code === NO_MATCH || code === SPEECH_TIMEOUT) return { failure: 'no-speech' };
	if (code === INSUFFICIENT_PERMISSIONS) return { failure: 'not-allowed' };

	return { failure: 'failed', detail: `SpeechRecognizer error ${code}` };
}

/**
 * @description Transcribes audio with Android's speech recognizer, on the device when it can: the clip is decoded to
 * PCM and handed to the recognizer as its audio source, which Android allows from version 13.
 * @param native The plugin's native bridge.
 * @param url The audio's address.
 * @returns The transcript, or why there is none.
 */
export async function transcribeOnAndroid(
	native: NativeBridge,
	url: string,
): Promise<TranscriptResult> {
	const { java } = native;
	const response = await fetch(url);

	if (!response.ok) throw new Error(`HTTP ${response.status}`);

	const source = writeCacheFile(
		java,
		'unbound-transcript.audio',
		toBase64(await response.arrayBuffer()),
	);
	const decoded = decodeToPcm(java, source);
	const raw = Uint8Array.from(atob(readCacheFile(java, decoded.path)), (character) =>
		character.charCodeAt(0),
	);
	const mono = toMono(
		new Int16Array(raw.buffer, 0, Math.floor(raw.length / 2)),
		decoded.sampleRate,
		decoded.channels,
	);
	const pcm = {
		path: writeCacheFile(java, 'unbound-transcript.pcm', toBase64(mono.buffer as ArrayBuffer)),
		sampleRate: SPEECH_RATE,
		channels: 1,
	};
	const scope = native.ui.createScope();

	return new Promise<TranscriptResult>((resolve) => {
		const report = native.ui.callback((text: string, code: number) => {
			scope.dispose();

			if (code === -1) resolve({ failure: 'unavailable' });
			else if (code !== 0) {
				logger.warn(`Speech recognizer stopped with error ${code}.`);
				resolve(failureFor(code));
			} else resolve(text.trim() ? { text: text.trim() } : { failure: 'no-speech' });
		});

		native.ui.run(startRecognition, scope, pcm.path, pcm.sampleRate, pcm.channels, report);
	});
}

export default transcribeOnAndroid;
