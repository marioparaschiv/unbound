import type { MarkdownParserModule, SimpleMarkdownModule } from '@unbound-app/types/markdown';
import type { ImageProps, ImageURISource } from 'react-native';

import { byProps } from '~/metro/filters';
import { find } from '~/metro/lookups';

/** React Native's `ImageSourceUtils`, which every `Image` render resolves its source through. */
type ImageSourcesModule = {
	/** Resolves the source or sources an `Image` with these props loads, or `null` for none. */
	getImageSourcesFromImageProps: (props: ImageProps) => ImageURISource | ImageURISource[] | null;
};

/** The React Native instance Discord bundles, read from `window.ReactNative`. */
export const ReactNative = window.ReactNative;
export const React = window.React;

/** Discord's copy of `react-native-reanimated`; found on first access. */
export const Reanimated = find(byProps('useAnimatedStyle', 'useSharedValue'));
/** Discord's copy of `react-native-gesture-handler`; found on first access. */
export const Gestures = find(byProps('PanGestureHandler'));
/** Discord's clipboard module, which reads and writes strings and images; found on first access. */
export const Clipboard = find(byProps('setString', 'getString', 'setImage', 'getImage'));
/** Discord's markdown parser, which turns message text into an AST or React nodes; found on first access. */
export const MarkdownParser: MarkdownParserModule = find(
	byProps('parse', 'parseToAST', 'reactParserFor'),
);
/** Discord's copy of `simple-markdown`, whose block rules parse whole documents; found on first access. */
export const SimpleMarkdown: SimpleMarkdownModule = find(
	byProps('parserFor', 'outputFor', 'defaultRules'),
);
/** Discord's copy of `react-native-screens`, with `FullWindowOverlay`; found on first access. */
export const Screens = find(byProps('FullWindowOverlay'));
/** Discord's copy of `react-native-svg`, with `Svg` and `Path`; found on first access. */
export const SVG = find(byProps('Svg', 'Path'));
/** Discord's slash command module, with `getBuiltInCommands`; found on first access. */
export const Commands = find(byProps('getBuiltInCommands'));
/** Discord's copy of Moment.js; found on first access. */
export const Moment = find(byProps('isMoment'));

/** Discord's `util` module, with `inspect` for printing values; found on first access. */
export const Util = find(byProps('inspect'));
/** React Native's asset registry, with `registerAsset`; found on first access. */
export const Assets = find(byProps('registerAsset'));
/** React Native's image source resolver; patching it changes the source every `Image` renders. */
export const ImageSources: ImageSourcesModule = find(byProps('getImageSourcesFromImageProps'));
/** Discord's module with `createBotMessage`, which builds a local message from Clyde; found on first access. */
export const Clyde = find(byProps('createBotMessage'));
/** Discord's constants module, with `Fonts`, `Endpoints` and more; found on first access. */
export const Constants = find(byProps('Fonts', 'Endpoints'));
/** Discord's module exporting its `Radius` corner radius tokens; found on first access. */
export const Radius = find(byProps('Radius'));
/** Discord's design tokens, with `colors` and `internal`; found on first access. */
export const Theme = find(byProps('colors', 'internal'));
/** Discord's HTTP client for its API, with `getAPIBaseURL`; found on first access. */
export const REST = find(byProps('getAPIBaseURL'));
/** Discord's localisation module, with `getLanguages`, `getSystemLocale` and `intl`; found on first access. */
export const i18n = find(byProps('getLanguages', 'getSystemLocale', 'intl'));
