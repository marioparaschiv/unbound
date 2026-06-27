import { findByPropsLazy } from '~/api/metro/wrappers';

export const ReactNative: typeof import('react-native') = window.ReactNative;
export const React: typeof import('react') = window.React;

export const Reanimated = findByPropsLazy('useAnimatedStyle', 'useSharedValue');
export const Gestures = findByPropsLazy('Gesture', 'GestureDetector', 'createNativeWrapper');
export const Clipboard = findByPropsLazy('setString', 'getString', 'setImage', 'getImage');
export const MarkdownParser = findByPropsLazy('parse', 'parseToAST', 'reactParserFor');
export const Screens = findByPropsLazy('FullWindowOverlay');
export const SVG = findByPropsLazy('Svg', 'Path');
export const Commands = findByPropsLazy('getBuiltInCommands');
export const Moment = findByPropsLazy('isMoment');

export const Util = findByPropsLazy('inspect');
export const Flux = findByPropsLazy('Store', 'connectStores');
export const Assets = findByPropsLazy('registerAsset');
export const Clyde = findByPropsLazy('createBotMessage');
export const Dispatcher = findByPropsLazy('dispatch', 'subscribe');
export const Constants = findByPropsLazy('Fonts', 'Endpoints');
export const Theme = findByPropsLazy('colors', 'internal');
export const REST = findByPropsLazy('getAPIBaseURL');
export const i18n = findByPropsLazy('getLanguages', 'getSystemLocale', 'intl');
