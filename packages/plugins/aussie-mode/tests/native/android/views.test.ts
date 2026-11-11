import { expect, mock, test } from 'bun:test';
import type { NativeJavaValue, NativeBridge } from '@unbound-app/api/native';

const listeners = new Map<string, () => Promise<void> | void>();
const composer = { type: 'handle', value: 'composer' } as const;
const content = { type: 'handle', value: 'content' } as const;
const decor = { type: 'handle', value: 'decor' } as const;
const rect = { type: 'handle', value: 'rect' } as const;
let composerTop = 96;
let translationY = 0;
let rotation = 0;
let removedListeners = 0;
let findViewCalls = 0;

mock.module('react-native', () => ({
	Keyboard: {
		addListener: (event: string, listener: () => Promise<void> | void) => {
			listeners.set(event, listener);

			return {
				remove: () => {
					listeners.delete(event);
					removedListeners++;
				},
			};
		},
	},
}));

mock.module('@unbound-plugins/shared/native/android/views', () => ({
	currentDecorView: () => decor,
}));

const { rotateScreen } = await import('~/native/views-android');

function createNative(): NativeBridge {
	const java = {
		construct: () => rect,
		findViews: async () => {
			findViewCalls++;

			return [composer];
		},
		getField: (_target: unknown, name: string) =>
			({ type: 'int', value: name === 'top' ? composerTop : 0 }) as NativeJavaValue,
		getClass: () => ({ type: 'handle', value: 'class' }),
		invoke: () => ({ type: 'handle', value: 'invoked' }),
		invokeAsync: async (target: unknown, name: string, args: NativeJavaValue[]) => {
			if (target === decor && name === 'getChildAt') return content;
			if (target === content && name === 'setRotation' && args[0]?.type === 'float') {
				rotation = args[0].value;
			}
			if (target === content && name === 'setTranslationY' && args[0]?.type === 'float') {
				translationY = args[0].value;
			}
			if (target === composer && name === 'getGlobalVisibleRect') {
				return { type: 'boolean', value: true };
			}

			return { type: 'void' };
		},
	};

	return {
		java: java as never,
		runtime: {
			subscribe: () => ({ active: true, remove: () => {} }),
		},
	} as never;
}

test('keeps the composer at the rotated top while the keyboard is open', async () => {
	listeners.clear();
	composerTop = 96;
	translationY = 0;
	rotation = 0;
	removedListeners = 0;
	findViewCalls = 0;

	const native = createNative();

	await rotateScreen(native, 180);
	composerTop = 942;
	await listeners.get('keyboardDidShow')?.();

	expect(rotation).toBe(180);
	expect(translationY).toBe(-846);

	await listeners.get('keyboardDidHide')?.();
	expect(translationY).toBe(0);

	composerTop = 942;
	await listeners.get('keyboardDidShow')?.();
	expect(translationY).toBe(-846);

	await listeners.get('keyboardDidHide')?.();

	await rotateScreen(native, 0);
	expect(removedListeners).toBe(2);
});

test('does not measure native views after rotation stops during keyboard settling', async () => {
	listeners.clear();
	composerTop = 96;
	translationY = 0;
	rotation = 0;
	removedListeners = 0;
	findViewCalls = 0;

	const native = createNative();
	await rotateScreen(native, 180);

	const pendingShow = listeners.get('keyboardDidShow')?.();
	await rotateScreen(native, 0);
	await pendingShow;

	expect(rotation).toBe(0);
	expect(translationY).toBe(0);
	expect(findViewCalls).toBe(1);
	expect(removedListeners).toBe(2);
});
