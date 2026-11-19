import type {
	NativeJavaHandleValue,
	NativeJavaValue,
	NativeObjectHandle,
	PluginContext,
} from '@unbound-app/api/native';

import type { DevicePrelude } from '~/lib/device-prelude';
import type { GesturePath } from '~/lib/gesture-path';

type DevNative = { __unboundDevNative?: () => PluginContext['native'] };

/**
 * @description Drives one drag on the connected device, held as long as the path says, which replayed touches cannot do.
 * Android sends real `MotionEvent`s to the current activity. iOS finds the first enabled pan recognizer above the
 * point and calls its targets' actions with a stand-in recognizer that reports each step's state, translation and
 * velocity, since UIKit ignores state changes outside a real touch. Runs on the device through `toDeviceCode`.
 * @param device The device prelude.
 * @param path The start point in points, and the steps from `gesturePath`.
 * @returns What was driven, or why nothing was.
 */
export async function driveGesture(
	{ nativeBridge }: DevicePrelude,
	path: GesturePath,
): Promise<string> {
	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
	const devNative = (globalThis as DevNative).__unboundDevNative?.();
	const devHas = (capability: string) =>
		Boolean(devNative?.capabilities.includes(capability as never));
	const android =
		(devHas('native.java.invokeAsync') ? devNative?.java : undefined) ??
		nativeBridge('android', [
			'native.java.classes',
			'native.java.fields',
			'native.java.invokeAsync',
		])?.native.java;
	const ios =
		(devHas('native.objc.classDefinition') ? devNative?.objc : undefined) ??
		nativeBridge('ios', ['native.objc.invokeAsync', 'native.objc.classDefinition'])?.native
			.objc;
	const last = path.steps.at(-1) ?? { dx: 0, dy: 0 };

	if (android) {
		const java = android;
		const handle = (value: NativeJavaValue): NativeJavaHandleValue | null =>
			value.type === 'handle' ? value : null;
		const tracker = handle(
			java.getField(java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE'),
		);
		const activity = tracker ? handle(java.invoke(tracker, 'currentActivity')) : null;

		if (!activity) {
			return 'No Android activity is resumed.';
		}

		const resources = handle(java.invoke(activity, 'getResources'));
		const metrics = resources ? handle(java.invoke(resources, 'getDisplayMetrics')) : null;
		const densityValue = metrics ? java.getField(metrics, 'density') : null;
		const density = densityValue && 'value' in densityValue ? Number(densityValue.value) : 1;
		const MotionEvent = java.getClass('android.view.MotionEvent');
		const clock = java.getClass('android.os.SystemClock');

		function uptime(): number {
			const value = java.invoke(clock, 'uptimeMillis');

			return 'value' in value ? Number(value.value) : 0;
		}
		const downTime = uptime();

		async function send(action: number, dx: number, dy: number) {
			const event = handle(
				java.invoke(MotionEvent, 'obtain', [
					{ type: 'long', value: downTime },
					{ type: 'long', value: uptime() },
					{ type: 'int', value: action },
					{ type: 'float', value: (path.x + dx) * density },
					{ type: 'float', value: (path.y + dy) * density },
					{ type: 'int', value: 0 },
				]),
			);

			if (!event) return;

			await java.invokeAsync(activity!, 'dispatchTouchEvent', [event]);
			java.invoke(event, 'recycle');
		}

		await send(0, 0, 0);

		for (const step of path.steps) {
			await sleep(step.delay);
			await send(2, step.dx, step.dy);
		}

		await sleep(path.hold);
		await send(1, last.dx, last.dy);

		return `Dragged from ${path.x},${path.y} by ${last.dx},${last.dy} dp in ${path.steps.length} steps.`;
	}

	if (!ios) {
		return 'No native bridge can drive gestures. Use a development build, or enable a plugin that defines Objective-C classes, such as PDF Viewer.';
	}

	const objc = ios;
	const send = (target: NativeObjectHandle, selector: string, ...args: unknown[]) =>
		objc.invokeAsync(target, selector, args);
	const application = objc.getClass('UIApplication')!;
	const shared = (await send(application, 'sharedApplication')) as NativeObjectHandle;
	const window = (await send(shared, 'keyWindow')) as NativeObjectHandle | null;
	const panClass = objc.getClass('UIPanGestureRecognizer');
	const start = objc.struct('CGPoint', { x: path.x, y: path.y });
	let view = window
		? ((await send(window, 'hitTest:withEvent:', start, null)) as NativeObjectHandle | null)
		: null;
	let pan: NativeObjectHandle | null = null;
	let owner: NativeObjectHandle | null = null;

	for (let depth = 0; view && !pan && depth < 40; depth++) {
		const recognizers = ((await send(view, 'gestureRecognizers')) ??
			[]) as NativeObjectHandle[];

		for (const recognizer of recognizers) {
			if (pan) {
				break;
			}

			const isPan = (await send(recognizer, 'isKindOfClass:', panClass)) === true;

			if (isPan && (await send(recognizer, 'isEnabled')) === true) {
				pan = recognizer;
				owner = view;
			}
		}

		if (!pan) {
			view = (await send(view, 'superview')) as NativeObjectHandle | null;
		}
	}

	if (!pan || !owner) {
		return `No pan gesture recognizer is at ${path.x},${path.y}.`;
	}

	const described = await send(pan, 'description');
	const description = typeof described === 'string' ? described : '';
	const receivers: { target: NativeObjectHandle; action: string }[] = [];

	for (const [, action = '', className] of description.matchAll(
		/action=([^,]+), target=<(\S+) /g,
	)) {
		let candidate: NativeObjectHandle | null = owner;

		for (let depth = 0; candidate && depth < 40; depth++) {
			if (objc.className(candidate) === className) {
				receivers.push({ target: candidate, action });
				break;
			}

			candidate = (await send(candidate, 'superview')) as NativeObjectHandle | null;
		}
	}

	if (!receivers.length) {
		return `Found ${objc.className(pan)} but not its target.`;
	}

	const drive = { state: 0, dx: 0, dy: 0, vx: 0, vy: 0 };
	const point = (x: number, y: number) => objc.struct('CGPoint', { x, y });
	const Driven = objc.defineClass('UnboundDrivenPanGestureRecognizer', 'UIPanGestureRecognizer', {
		state: { signature: { returnType: 'i64', args: [] }, implementation: () => drive.state },
		'translationInView:': {
			signature: { returnType: { struct: 'CGPoint' }, args: ['object'] },
			implementation: () => point(drive.dx, drive.dy),
		},
		'velocityInView:': {
			signature: { returnType: { struct: 'CGPoint' }, args: ['object'] },
			implementation: () => point(drive.vx, drive.vy),
		},
		'locationInView:': {
			signature: { returnType: { struct: 'CGPoint' }, args: ['object'] },
			implementation: () => point(path.x + drive.dx, path.y + drive.dy),
		},
		view: { signature: { returnType: 'object', args: [] }, implementation: () => owner },
	});
	const stand = objc.alloc(Driven);

	async function step(state: number, values: Partial<typeof drive>) {
		Object.assign(drive, { state }, values);

		for (const { target, action } of receivers) {
			await send(target, action, stand);
		}
	}

	await step(1, { dx: 0, dy: 0, vx: 0, vy: 0 });

	for (const { delay, ...values } of path.steps) {
		await sleep(delay);
		await step(2, values);
	}

	await sleep(path.hold);
	await step(3, { ...path.release, dx: last.dx, dy: last.dy });

	const names = receivers.map(({ target, action }) => `${objc.className(target)} ${action}`);

	return `Dragged ${objc.className(pan)} on ${objc.className(owner)} by ${last.dx},${last.dy} pt in ${path.steps.length} steps, through ${names.join(', ')}.`;
}

export default { driveGesture };
