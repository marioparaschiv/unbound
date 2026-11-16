import type { NativeBridge, NativeObjectHandle } from '@unbound-app/api/native';

import type { SegmentPlayer } from '~/native/segment-player';

type ObjC = NativeBridge['objc'];

type Engine = {
	engine: NativeObjectHandle;
	node: NativeObjectHandle;
	file: NativeObjectHandle;
	rate: number;
	length: number;
};

async function openEngine(objc: ObjC, path: string): Promise<Engine | undefined> {
	const run = (handle: NativeObjectHandle, selector: string, args: unknown[] = []) =>
		objc.invokeAsync(handle, selector, args) as Promise<NativeObjectHandle | null>;
	const NSURL = objc.getClass('NSURL');
	const File = objc.getClass('AVAudioFile');
	const Engine = objc.getClass('AVAudioEngine');
	const Node = objc.getClass('AVAudioPlayerNode');

	if (!NSURL || !File || !Engine || !Node) return undefined;

	const url = objc.call(NSURL, 'fileURLWithPath:', path) as NativeObjectHandle;
	const file = await run(objc.alloc(File), 'initForReading:error:', [url, null]);

	if (!file) return undefined;

	const format = (await run(file, 'processingFormat'))!;
	const engine = objc.call(Engine, 'new') as NativeObjectHandle;
	const node = objc.call(Node, 'new') as NativeObjectHandle;

	await run(engine, 'attachNode:', [node]);
	await run(engine, 'connect:to:format:', [node, (await run(engine, 'mainMixerNode'))!, format]);

	if (!(await run(engine, 'startAndReturnError:', [null]))) return undefined;

	return {
		engine,
		node,
		file,
		rate: Number(await objc.invokeAsync(format, 'sampleRate', [])),
		length: Number(await objc.invokeAsync(file, 'length', [])),
	};
}

/**
 * @description Plays a transcript's audio from any point with `AVAudioEngine`, which reads Ogg Opus voice messages and
 * starts from a frame, so seeking needs no `CMTime`.
 * @param native The plugin's native bridge.
 * @param path The downloaded audio's path.
 * @returns The player.
 */
export function createSegmentPlayer(
	{ objc }: NativeBridge,
	path: string,
): SegmentPlayer | undefined {
	let opened: Promise<Engine | undefined> | undefined;

	return {
		async playFrom(seconds) {
			opened ??= openEngine(objc, path);

			const engine = await opened;

			if (!engine) return false;

			const start = Math.min(
				Math.max(0, Math.round(seconds * engine.rate)),
				engine.length - 1,
			);

			await objc.invokeAsync(engine.node, 'stop', []);
			await objc.invokeAsync(
				engine.node,
				'scheduleSegment:startingFrame:frameCount:atTime:completionHandler:',
				[engine.file, start, engine.length - start, null, null],
			);
			await objc.invokeAsync(engine.node, 'play', []);

			return true;
		},
		async stop() {
			const engine = await opened;

			if (!engine) return;

			await objc.invokeAsync(engine.node, 'stop', []);
			await objc.invokeAsync(engine.engine, 'stop', []);
			opened = undefined;
		},
	};
}

export default { createSegmentPlayer };
