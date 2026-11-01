import type { MarkdownParserModule } from '@unbound-app/types/markdown';
import type { ImageProps, ImageURISource } from 'react-native';

import { findByPropsLazy } from '~/metro/wrappers';

/** React Native's `ImageSourceUtils`, which every `Image` render resolves its source through. */
type ImageSourcesModule = {
	/** Resolves the source or sources an `Image` with these props loads, or `null` for none. */
	getImageSourcesFromImageProps: (props: ImageProps) => ImageURISource | ImageURISource[] | null;
};

/** The React Native instance Discord bundles, read from `window.ReactNative`. */
export const ReactNative = window.ReactNative;
export const React = window.React;

/** Discord's copy of `react-native-reanimated`; found on first access. */
export const Reanimated = findByPropsLazy('useAnimatedStyle', 'useSharedValue');
/** Discord's copy of `react-native-gesture-handler`; found on first access. */
export const Gestures = findByPropsLazy('PanGestureHandler');
/** Discord's clipboard module, which reads and writes strings and images; found on first access. */
export const Clipboard = findByPropsLazy('setString', 'getString', 'setImage', 'getImage');
/** Discord's markdown parser, which turns message text into an AST or React nodes; found on first access. */
export const MarkdownParser: MarkdownParserModule = findByPropsLazy(
	'parse',
	'parseToAST',
	'reactParserFor',
);
/** Discord's copy of `react-native-screens`, with `FullWindowOverlay`; found on first access. */
export const Screens = findByPropsLazy('FullWindowOverlay');
/** Discord's copy of `react-native-svg`, with `Svg` and `Path`; found on first access. */
export const SVG = findByPropsLazy('Svg', 'Path');
/** Discord's slash command module, with `getBuiltInCommands`; found on first access. */
export const Commands = findByPropsLazy('getBuiltInCommands');
/** Discord's copy of Moment.js; found on first access. */
export const Moment = findByPropsLazy('isMoment');

/** Discord's `util` module, with `inspect` for printing values; found on first access. */
export const Util = findByPropsLazy('inspect');
/** React Native's asset registry, with `registerAsset`; found on first access. */
export const Assets = findByPropsLazy('registerAsset');
/** React Native's image source resolver; patching it changes the source every `Image` renders. */
export const ImageSources: ImageSourcesModule = findByPropsLazy('getImageSourcesFromImageProps');
/** Discord's module with `createBotMessage`, which builds a local message from Clyde; found on first access. */
export const Clyde = findByPropsLazy('createBotMessage');
/** Discord's constants module, with `Fonts`, `Endpoints` and more; found on first access. */
export const Constants = findByPropsLazy('Fonts', 'Endpoints');
/** Discord's module exporting its `Radius` corner radius tokens; found on first access. */
export const Radius = findByPropsLazy('Radius');
/** Discord's design tokens, with `colors` and `internal`; found on first access. */
export const Theme = findByPropsLazy('colors', 'internal');
/** Discord's HTTP client for its API, with `getAPIBaseURL`; found on first access. */
export const REST = findByPropsLazy('getAPIBaseURL');
/** Discord's localisation module, with `getLanguages`, `getSystemLocale` and `intl`; found on first access. */
export const i18n = findByPropsLazy('getLanguages', 'getSystemLocale', 'intl');
