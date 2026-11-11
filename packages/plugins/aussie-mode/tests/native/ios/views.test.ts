import { expect, mock, test } from 'bun:test';

const listeners = new Map<string, () => void>();
const runtimeListeners = new Map<string, (payload: unknown) => void>();
const transforms: Array<{ name: string; value: Record<string, number> }> = [];
let inputTop = 601;
let removedSubscriptions = 0;
let removedRuntimeSubscriptions = 0;
let keyboardVisible = false;
let inputFound = true;

function rect(y: number, height: number) {
	return {
		name: 'CGRect',
		value: { origin: { x: 0, y }, size: { width: 375, height } },
	};
}

mock.module('react-native', () => ({
	Keyboard: {
		isVisible: () => keyboardVisible,
		addListener: (event: string, listener: () => void) => {
			listeners.set(event, listener);

			return {
				remove: () => {
					listeners.delete(event);
					removedSubscriptions++;
				},
			};
		},
	},
}));

const { rotateScreen } = await import('~/native/ios/views');

function createNative() {
	const rootView = { id: 'root-view' };
	const inputView = { id: 'chat-input' };
	const objc = {
		getClass: () => ({ id: 'UIApplication' }),
		batch: async (steps: Array<{ selector: string }>) => {
			if (steps[0]?.selector === 'sharedApplication')
				return [undefined, { id: 'key-window' }];
			if (steps[0]?.selector === 'rootViewController') return [undefined, rootView];

			return [rect(0, 32), rect(inputTop, 32), rect(0, 667)];
		},
		findViews: async () => (inputFound ? [inputView] : []),
		struct: (name: string, value: Record<string, number>) => ({ name, value }),
		invokeAsync: async (
			_target: unknown,
			_selector: string,
			args: Array<{ name: string; value: Record<string, number> }>,
		) => {
			transforms.push(args[0]);
		},
	};

	return {
		objc,
		runtime: {
			subscribe: (event: string, listener: (payload: unknown) => void) => {
				runtimeListeners.set(event, listener);

				return {
					active: true,
					remove: () => {
						runtimeListeners.delete(event);
						removedRuntimeSubscriptions++;
					},
				};
			},
		},
	} as never;
}

async function settleKeyboardEvents(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

test('offsets the rotated composer for the keyboard and removes listeners on stop', async () => {
	listeners.clear();
	runtimeListeners.clear();
	transforms.length = 0;
	inputTop = 601;
	keyboardVisible = false;
	inputFound = true;
	removedSubscriptions = 0;
	removedRuntimeSubscriptions = 0;
	const native = createNative();

	await rotateScreen(native, 180);
	await settleKeyboardEvents();
	inputTop = 407;
	listeners.get('keyboardWillShow')?.();
	await settleKeyboardEvents();
	listeners.get('keyboardDidShow')?.();
	await settleKeyboardEvents();

	expect(transforms.at(-1)?.value.ty).toBe(-194);

	listeners.get('keyboardWillHide')?.();
	await settleKeyboardEvents();
	expect(transforms.at(-1)?.value.ty).toBe(0);

	await rotateScreen(native, 0);

	expect(listeners.size).toBe(0);
	expect(removedSubscriptions).toBe(4);
});

test('removes keyboard listeners before the asynchronous stop transform', async () => {
	listeners.clear();
	runtimeListeners.clear();
	transforms.length = 0;
	keyboardVisible = false;
	inputFound = true;
	removedSubscriptions = 0;
	removedRuntimeSubscriptions = 0;
	const native = createNative();

	await rotateScreen(native, 180);
	await settleKeyboardEvents();

	const stop = rotateScreen(native, 0);

	expect(listeners.size).toBe(0);
	expect(transforms.at(-1)?.value.ty).toBe(0);

	await stop;

	expect(removedSubscriptions).toBe(4);
	expect(removedRuntimeSubscriptions).toBe(1);
});

test('captures the hidden composer position even when keyboard visibility is stale', async () => {
	listeners.clear();
	runtimeListeners.clear();
	transforms.length = 0;
	inputTop = 601;
	keyboardVisible = true;
	inputFound = true;
	const native = createNative();

	await rotateScreen(native, 180);
	inputTop = 407;
	listeners.get('keyboardWillShow')?.();
	await settleKeyboardEvents();
	listeners.get('keyboardDidShow')?.();
	await settleKeyboardEvents();

	expect(transforms.at(-1)?.value.ty).toBe(-194);

	keyboardVisible = false;
	await rotateScreen(native, 0);
});

test('refreshes the baseline when the chat input attaches after startup', async () => {
	listeners.clear();
	runtimeListeners.clear();
	transforms.length = 0;
	inputTop = 601;
	keyboardVisible = false;
	inputFound = false;
	const native = createNative();

	await rotateScreen(native, 180);
	inputFound = true;
	runtimeListeners.get('channel.changed')?.({});
	await settleKeyboardEvents();
	inputTop = 407;
	listeners.get('keyboardWillShow')?.();
	await settleKeyboardEvents();
	listeners.get('keyboardDidShow')?.();
	await settleKeyboardEvents();

	expect(transforms.at(-1)?.value.ty).toBe(-194);

	await rotateScreen(native, 0);
});
