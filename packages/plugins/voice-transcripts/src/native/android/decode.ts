import {
	javaInt,
	javaNumber,
	javaReference,
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge, NativeJavaReference } from '@unbound-app/api/native';

type Java = NativeBridge['java'];

const BASE64_DEFAULT = 0;
const CHUNK_CHARACTERS = 4000;
const TIMEOUT_US = 10_000;
const END_OF_STREAM = 4;
const FORMAT_CHANGED = -2;
const MAX_STEPS = 20_000;
const SPEECH_RATE = 16_000;

/** Decoded audio: a raw 16-bit PCM file, and its sample rate and channels. */
export type PcmAudio = { path: string; sampleRate: number; channels: number };

function numberOf(value: Parameters<typeof javaNumber>[0]): number {
	return javaNumber(value) ?? 0;
}

function filesDir(java: Java): NativeJavaReference {
	const app = javaReference(
		java.invoke(java.getClass('android.app.ActivityThread'), 'currentApplication', []),
	);
	const dir = app && javaReference(java.invoke(app, 'getCacheDir', []));

	if (!dir) throw new Error('no cache directory');

	return dir;
}

/**
 * @description Writes base64 bytes to a file in Discord's cache folder, in pieces under the bridge's 4 KB string limit.
 * @param java The plugin's Java bridge.
 * @param name The file's name.
 * @param base64 The bytes, as base64.
 * @returns The file's absolute path.
 */
export function writeCacheFile(java: Java, name: string, base64: string): string {
	const file = java.construct('java.io.File', [filesDir(java), javaString(name)]);
	const stream = java.construct('java.io.FileOutputStream', [file]);
	const Base64 = java.getClass('android.util.Base64');

	try {
		for (let offset = 0; offset < base64.length; offset += CHUNK_CHARACTERS) {
			const bytes = javaReference(
				java.invoke(Base64, 'decode', [
					javaString(base64.slice(offset, offset + CHUNK_CHARACTERS)),
					javaInt(BASE64_DEFAULT),
				]),
			);

			if (bytes) java.invoke(stream, 'write', [bytes]);
		}
	} finally {
		java.invoke(stream, 'close', []);
	}

	return javaText(java.invoke(file, 'getAbsolutePath', [])) ?? '';
}

function copyOut(
	java: Java,
	codec: NativeJavaReference,
	index: number,
	size: number,
	out: NativeJavaReference,
) {
	if (size <= 0) return;

	const buffer = javaReference(java.invoke(codec, 'getOutputBuffer', [javaInt(index)]))!;
	const byteType = java.getField(java.getClass('java.lang.Byte'), 'TYPE') as never;
	const bytes = javaReference(
		java.invoke(java.getClass('java.lang.reflect.Array'), 'newInstance', [
			byteType,
			javaInt(size),
		]),
	)!;

	java.invoke(buffer, 'get', [bytes]);
	java.invoke(out, 'write', [bytes]);
}

/**
 * @description Decodes an audio file, such as a voice message's Ogg Opus clip, to raw 16-bit PCM with Android's own
 * `MediaExtractor` and `MediaCodec`.
 * @param java The plugin's Java bridge.
 * @param source The audio file's path.
 * @returns The PCM file and its format.
 */
export function decodeToPcm(java: Java, source: string): PcmAudio {
	const extractor = java.construct('android.media.MediaExtractor', []);

	java.invoke(extractor, 'setDataSource', [javaString(source)]);
	java.invoke(extractor, 'selectTrack', [javaInt(0)]);

	const format = javaReference(java.invoke(extractor, 'getTrackFormat', [javaInt(0)]))!;
	const mime = javaText(java.invoke(format, 'getString', [javaString('mime')])) ?? '';
	const codec = javaReference(
		java.invoke(java.getClass('android.media.MediaCodec'), 'createDecoderByType', [
			javaString(mime),
		]),
	)!;
	const info = java.construct('android.media.MediaCodec$BufferInfo', []);
	const path = `${source}.pcm`;
	const out = java.construct('java.io.FileOutputStream', [javaString(path)]);
	let sampleRate = numberOf(java.invoke(format, 'getInteger', [javaString('sample-rate')]));
	let channels = numberOf(java.invoke(format, 'getInteger', [javaString('channel-count')]));
	let inputDone = false;

	if (mime === 'audio/opus')
		java.invoke(format, 'setInteger', [javaString('sample-rate'), javaInt(SPEECH_RATE)]);

	java.invoke(codec, 'configure', [
		format,
		{ type: 'null', class: 'android.view.Surface' },
		{ type: 'null', class: 'android.media.MediaCrypto' },
		javaInt(0),
	]);
	java.invoke(codec, 'start', []);

	try {
		for (let step = 0; step < MAX_STEPS; step++) {
			if (!inputDone) {
				const input = numberOf(
					java.invoke(codec, 'dequeueInputBuffer', [{ type: 'long', value: TIMEOUT_US }]),
				);

				if (input >= 0) {
					const buffer = javaReference(
						java.invoke(codec, 'getInputBuffer', [javaInt(input)]),
					)!;
					const size = numberOf(
						java.invoke(extractor, 'readSampleData', [buffer, javaInt(0)]),
					);

					if (size < 0) {
						java.invoke(codec, 'queueInputBuffer', [
							javaInt(input),
							javaInt(0),
							javaInt(0),
							{ type: 'long', value: 0 },
							javaInt(END_OF_STREAM),
						]);
						inputDone = true;
					} else {
						const time = java.invoke(extractor, 'getSampleTime', []);

						java.invoke(codec, 'queueInputBuffer', [
							javaInt(input),
							javaInt(0),
							javaInt(size),
							{ type: 'long', value: numberOf(time) },
							javaInt(0),
						]);
						java.invoke(extractor, 'advance', []);
					}
				}
			}

			const output = numberOf(
				java.invoke(codec, 'dequeueOutputBuffer', [
					info,
					{ type: 'long', value: TIMEOUT_US },
				]),
			);

			if (output === FORMAT_CHANGED) {
				const changed = javaReference(java.invoke(codec, 'getOutputFormat', []))!;

				sampleRate = numberOf(
					java.invoke(changed, 'getInteger', [javaString('sample-rate')]),
				);
				channels = numberOf(
					java.invoke(changed, 'getInteger', [javaString('channel-count')]),
				);
			} else if (output >= 0) {
				copyOut(java, codec, output, numberOf(java.getField(info, 'size')), out);
				java.invoke(codec, 'releaseOutputBuffer', [
					javaInt(output),
					{ type: 'boolean', value: false },
				]);

				if (numberOf(java.getField(info, 'flags')) & END_OF_STREAM) break;
			}
		}
	} finally {
		java.invoke(out, 'close', []);
		java.invoke(codec, 'stop', []);
		java.invoke(codec, 'release', []);
		java.invoke(extractor, 'release', []);
	}

	return { path, sampleRate, channels };
}

/**
 * @description Reads a file's bytes as base64, for handing back to JavaScript.
 * @param java The plugin's Java bridge.
 * @param path The file's path.
 * @returns The bytes, as base64.
 */
export function readCacheFile(java: Java, path: string): string {
	const file = javaReference(
		java.invoke(java.getClass('java.nio.file.Paths'), 'get', [
			javaString(path),
			{ type: 'array', componentType: 'java.lang.String', value: [] },
		]),
	)!;
	const bytes = javaReference(
		java.invoke(java.getClass('java.nio.file.Files'), 'readAllBytes', [file]),
	)!;
	const NO_WRAP = 2;

	return (
		javaText(
			java.invoke(java.getClass('android.util.Base64'), 'encodeToString', [
				bytes,
				javaInt(NO_WRAP),
			]),
		) ?? ''
	);
}
