import { findByProps } from '~/api/metro';

export const ReactNative: typeof import('react-native') = window.ReactNative;
export const React: typeof import('react') = window.React;

export const Reanimated = findByProps('useAnimatedStyle', 'useSharedValue', { lazy: true });
export const Gestures = findByProps('Gesture', 'GestureDetector', 'createNativeWrapper', {
	lazy: true,
});
export const Clipboard = findByProps('setString', 'getString', 'setImage', 'getImage', {
	lazy: true,
});
export const MarkdownParser = findByProps('parse', 'parseToAST', 'reactParserFor', { lazy: true });
export const Screens = findByProps('FullWindowOverlay', { lazy: true });
export const SVG = findByProps('Svg', 'Path', { lazy: true });
export const Commands = findByProps('getBuiltInCommands', { lazy: true });
export const Moment = findByProps('isMoment');

export const Util = findByProps('inspect', { lazy: true });
export const Flux = findByProps('Store', 'connectStores', { lazy: true });
export const Assets = findByProps('registerAsset', { lazy: true });
export const Clyde = findByProps('createBotMessage', { lazy: true });
export const Dispatcher = findByProps('dispatch', 'subscribe', { lazy: true });
export const Constants = findByProps('Fonts', 'Endpoints', { lazy: true });
export const Theme = findByProps('colors', 'internal', { lazy: true });
export const REST = findByProps('getAPIBaseURL', { lazy: true });
export const i18n = findByProps('Messages', '_requestedLocale', { lazy: true });
