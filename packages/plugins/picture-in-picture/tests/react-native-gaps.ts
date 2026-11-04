import { metro } from '@unbound-app/api';
import { mock } from 'bun:test';

// The kit's `react-native` has no `NativeModules` or `AppState`, which the Android code imports when the plugin loads.
// The kit cannot fake them yet, so this preload adds them to its fake, after the preset and before any test imports it.
mock.module('react-native', () => ({
	...metro.common.ReactNative,
	NativeModules: {},
	AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) },
}));
