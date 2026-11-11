import { Keyboard } from 'react-native';
import type {
	NativeObjCBridge,
	NativeObjectHandle,
	NativePluginBridge,
	NativeRuntimeEventToken,
	NativeStruct,
} from '@unbound-app/api/native';

import { keyboardRotationOffset, type ChatInputLayout } from '~/lib/keyboard-layout-ios';

type CGRectFields = {
	origin: { x: number; y: number };
	size: { width: number; height: number };
};

type RotationSession = {
	objc: NativeObjCBridge;
	rootView: NativeObjectHandle;
	baseline?: ChatInputLayout;
	baselinePromise?: Promise<ChatInputLayout | undefined>;
	pendingBaseline?: Promise<ChatInputLayout | undefined>;
	runtimeToken?: NativeRuntimeEventToken;
	offsetY: number;
	generation: number;
	subscriptions: ReturnType<typeof Keyboard.addListener>[];
};

let activeSession: RotationSession | undefined;

function rectangle(value: unknown): CGRectFields | undefined {
	if (!value || typeof value !== 'object' || Reflect.get(value, 'name') !== 'CGRect') return;

	const fields = Reflect.get(value, 'value');

	if (!fields || typeof fields !== 'object') return;

	const origin = Reflect.get(fields, 'origin');
	const size = Reflect.get(fields, 'size');

	if (!origin || typeof origin !== 'object' || !size || typeof size !== 'object') return;

	const x = Reflect.get(origin, 'x');
	const y = Reflect.get(origin, 'y');
	const width = Reflect.get(size, 'width');
	const height = Reflect.get(size, 'height');

	if (
		typeof x !== 'number' ||
		typeof y !== 'number' ||
		typeof width !== 'number' ||
		typeof height !== 'number' ||
		![x, y, width, height].every(Number.isFinite)
	) {
		return;
	}

	return { origin: { x, y }, size: { width, height } };
}

async function getRootView(objc: NativeObjCBridge): Promise<NativeObjectHandle | undefined> {
	const applicationClass = objc.getClass('UIApplication');

	if (!applicationClass) return;

	const [, keyWindow] = await objc.batch([
		{ target: applicationClass, selector: 'sharedApplication', args: [] },
		{ target: { $nativeBatchResult: 0 }, selector: 'keyWindow', args: [] },
	]);

	if (!keyWindow) return;

	const [, rootView] = await objc.batch([
		{ target: keyWindow as NativeObjectHandle, selector: 'rootViewController', args: [] },
		{ target: { $nativeBatchResult: 0 }, selector: 'view', args: [] },
	]);

	return rootView as NativeObjectHandle | undefined;
}

async function readChatInputLayout(
	objc: NativeObjCBridge,
	rootView: NativeObjectHandle,
): Promise<ChatInputLayout | undefined> {
	const [inputView] = await objc.findViews(rootView, 'DCDChatInputComponentView', {
		maxDepth: 128,
		maxVisited: 8192,
		maxResults: 16,
		attachedOnly: true,
	});

	if (!inputView) return;

	const [inputBoundsResult, inputFrameResult, rootBoundsResult] = await objc.batch([
		{ target: inputView, selector: 'bounds', args: [] },
		{
			target: inputView,
			selector: 'convertRect:toView:',
			args: [{ $nativeBatchResult: 0 }, rootView],
		},
		{ target: rootView, selector: 'bounds', args: [] },
	]);
	const inputBounds = rectangle(inputBoundsResult);
	const inputFrame = rectangle(inputFrameResult);
	const rootBounds = rectangle(rootBoundsResult);

	if (!inputBounds || !inputFrame || !rootBounds || inputFrame.size.height <= 0) return;

	return {
		rootHeight: rootBounds.size.height,
		inputTop: inputFrame.origin.y,
		inputHeight: inputFrame.size.height,
	};
}

function reportLayoutFailure(operation: string, error: unknown): void {
	logger.error(`Failed to ${operation}:`, error);
}

function isKeyboardHiddenLayout(layout: ChatInputLayout): boolean {
	const spaceBelowInput = layout.rootHeight - layout.inputTop - layout.inputHeight;

	return spaceBelowInput <= 80;
}

function makeTransform(objc: NativeObjCBridge, degrees: number, offsetY: number): NativeStruct {
	const radians = (degrees * Math.PI) / 180;

	return objc.struct('CGAffineTransform', {
		a: Math.cos(radians),
		b: Math.sin(radians),
		c: -Math.sin(radians),
		d: Math.cos(radians),
		tx: 0,
		ty: offsetY,
	});
}

async function applyTransform(
	session: RotationSession,
	degrees: number,
	offsetY: number,
): Promise<void> {
	await session.objc.invokeAsync(session.rootView, 'setTransform:', [
		makeTransform(session.objc, degrees, offsetY),
	]);
}

function captureLayout(session: RotationSession, operation: string) {
	return readChatInputLayout(session.objc, session.rootView).catch((error: unknown) => {
		if (activeSession === session) reportLayoutFailure(operation, error);

		return undefined;
	});
}

function readBaseline(
	session: RotationSession,
	operation: string,
	refresh = false,
): Promise<ChatInputLayout | undefined> {
	if (!refresh && session.baselinePromise) return session.baselinePromise;
	if (!refresh && session.baseline) return Promise.resolve(session.baseline);

	const generation = session.generation;
	let pending: Promise<ChatInputLayout | undefined>;
	pending = captureLayout(session, operation)
		.then((layout) => {
			const baseline = layout && isKeyboardHiddenLayout(layout) ? layout : undefined;

			if (
				activeSession === session &&
				session.generation === generation &&
				(baseline || !session.baseline)
			) {
				session.baseline = baseline;
			}

			return baseline;
		})
		.finally(() => {
			if (session.baselinePromise === pending) session.baselinePromise = undefined;
		});
	session.baselinePromise = pending;

	return pending;
}

function stopKeyboardTracking(): void {
	for (const subscription of activeSession?.subscriptions ?? []) subscription.remove();
	activeSession?.runtimeToken?.remove();
	activeSession = undefined;
}

function startKeyboardTracking(
	native: NativePluginBridge,
	rootView: NativeObjectHandle,
): RotationSession {
	if (activeSession?.rootView === rootView) return activeSession;

	stopKeyboardTracking();

	const { objc } = native;
	const session: RotationSession = {
		objc,
		rootView,
		offsetY: 0,
		generation: 0,
		subscriptions: [],
	};
	activeSession = session;
	session.runtimeToken = native.runtime.subscribe('channel.changed', () => {
		if (!session.baseline) {
			void readBaseline(session, 'capture the chat input after a channel change', true);
		}
	});
	session.subscriptions = [
		Keyboard.addListener('keyboardWillShow', () => {
			const generation = ++session.generation;
			session.pendingBaseline = readBaseline(
				session,
				'read the chat input before the keyboard opens',
			);
			void session.pendingBaseline.then((baseline) => {
				if (activeSession === session && session.generation === generation) {
					session.baseline = baseline;
				}
			});
		}),
		Keyboard.addListener('keyboardDidShow', () => {
			const generation = session.generation;
			const baseline = session.pendingBaseline ?? Promise.resolve(session.baseline);

			void Promise.all([
				baseline,
				captureLayout(session, 'read the chat input after the keyboard opens'),
			])
				.then(async ([before, after]) => {
					if (activeSession !== session || session.generation !== generation) return;

					const offset = keyboardRotationOffset(before, after);

					if (offset === undefined) return;

					session.offsetY = offset;
					await applyTransform(session, 180, offset);
				})
				.catch((error: unknown) => {
					reportLayoutFailure('position the rotated chat input', error);
				});
		}),
		Keyboard.addListener('keyboardWillHide', () => {
			session.generation++;
			session.pendingBaseline = undefined;
			session.offsetY = 0;
			void applyTransform(session, 180, 0).catch((error: unknown) => {
				reportLayoutFailure('restore the rotated chat input', error);
			});
		}),
		Keyboard.addListener('keyboardDidHide', () => {
			const generation = session.generation;
			void readBaseline(session, 'refresh the chat input position', true).then((layout) => {
				if (activeSession === session && session.generation === generation) {
					session.baseline = layout;
				}
			});
		}),
	];

	void readBaseline(session, 'read the initial chat input position');

	return session;
}

export async function rotateScreen(native: NativePluginBridge, degrees: number): Promise<boolean> {
	const { objc } = native;

	if (degrees === 0) {
		const session = activeSession;
		stopKeyboardTracking();

		if (session) {
			await applyTransform(session, degrees, 0);
			return true;
		}
	}

	const rootView = await getRootView(objc);

	if (!rootView) return false;

	if (degrees === 0) {
		const session = { objc, rootView, offsetY: 0, generation: 0, subscriptions: [] };
		await applyTransform(session, degrees, 0);
		return true;
	}

	const session = startKeyboardTracking(native, rootView);
	await readBaseline(session, 'read the initial chat input position');
	await applyTransform(session, degrees, session.offsetY);

	return true;
}
