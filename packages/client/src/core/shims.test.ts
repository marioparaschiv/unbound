import { expect, mock, test } from 'bun:test';

// Discord's gesture handler, which no longer exports `createNativeWrapper`.
const gestureHandler = {
	__esModule: true,
	Gesture: {},
	GestureDetector: () => null,
	GestureHandlerRootView: () => null,
	PanGestureHandler: () => null,
};

mock.module('~/metro/finders', () => ({
	finder:
		() =>
		(...properties: string[]) =>
			properties.includes('GestureDetector') ? gestureHandler : null,
}));

const { default: shims } = await import('./shims');

test('resolves gesture handling without the removed createNativeWrapper export', () => {
	expect(shims['react-native-gesture-handler'].PanGestureHandler).toBeTypeOf('function');
});

test('has a shim for every library in the list', async () => {
	const { default: libraries } = await import('./shim-libraries.json');

	expect(Object.keys(shims)).toEqual(['react', 'react-native', ...Object.keys(libraries)]);
});
