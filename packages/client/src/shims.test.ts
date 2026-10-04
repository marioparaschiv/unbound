import { expect, mock, test } from 'bun:test';

const gestureHandler = {
	Gesture: {},
	GestureDetector: () => null,
	PanGestureHandler: () => null,
};

mock.module('~/api/metro/wrappers', () => ({
	findByPropsLazy(...properties: unknown[]) {
		return properties[0] === 'PanGestureHandler' ? gestureHandler : null;
	},
}));

const { default: shims } = await import('./shims');

test('resolves gesture handling without the removed createNativeWrapper export', () => {
	expect(shims['react-native-gesture-handler']).toBe(gestureHandler);
	expect(shims['react-native-gesture-handler'].PanGestureHandler).toBeTypeOf('function');
});
