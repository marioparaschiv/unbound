import type { MarkdownParserModule } from '@unbound-app/types/markdown';
import type { ImageProps, ImageURISource } from 'react-native';

import { findByPropsLazy } from '~/metro/wrappers';

/** React Native's `ImageSourceUtils`, which every `Image` render resolves its source through. */
type ImageSourcesModule = {
	getImageSourcesFromImageProps: (props: ImageProps) => ImageURISource | ImageURISource[] | null;
};

export const ReactNative = window.ReactNative;
export const React = window.React;

export const Reanimated = findByPropsLazy('useAnimatedStyle', 'useSharedValue');
export const Gestures = findByPropsLazy('PanGestureHandler');
export const Clipboard = findByPropsLazy('setString', 'getString', 'setImage', 'getImage');
export const MarkdownParser: MarkdownParserModule = findByPropsLazy(
	'parse',
	'parseToAST',
	'reactParserFor',
);
export const Screens = findByPropsLazy('FullWindowOverlay');
export const SVG = findByPropsLazy('Svg', 'Path');
export const Commands = findByPropsLazy('getBuiltInCommands');
export const Moment = findByPropsLazy('isMoment');

export const Util = findByPropsLazy('inspect');
export const Flux = findByPropsLazy('Store', 'connectStores');
export const FluxHooks = findByPropsLazy('useStateFromStores');
export const Assets = findByPropsLazy('registerAsset');
export const ImageSources: ImageSourcesModule = findByPropsLazy('getImageSourcesFromImageProps');
export const Clyde = findByPropsLazy('createBotMessage');
export const Dispatcher = findByPropsLazy('dispatch', 'subscribe');
export const Constants = findByPropsLazy('Fonts', 'Endpoints');
export const Radius = findByPropsLazy('Radius');
export const Theme = findByPropsLazy('colors', 'internal');
export const REST = findByPropsLazy('getAPIBaseURL');
export const i18n = findByPropsLazy('getLanguages', 'getSystemLocale', 'intl');
