import type { MarkdownParserModule } from '../../discord/markdown-parser';
import type { DispatcherModule } from '../../discord/flux-dispatcher';
import type { ThemingModule } from '../../discord/theming';
import type { ClydeModule } from '../../discord/messages';
import type { AssetsModule } from '../../discord/assets';
import type { i18nModule } from '../../discord/i18n';
import type { FluxModule } from '../../discord/flux';
import type { APIModule } from '../../discord/api';


export interface ConstantsModule {
	[key: PropertyKey]: any;
}

export type ReanimatedModule = typeof import('react-native-reanimated');
export type GesturesModule = typeof import('react-native-gesture-handler');
export type MomentModule = typeof import('moment');
export type EventsModule = typeof import('events');
export type ClipboardModule = typeof import('@react-native-clipboard/clipboard')['default'];
export type SVGModule = typeof import('react-native-svg');
export type ScreensModule = typeof import('react-native-screens');

export {
	DispatcherModule,
	i18nModule,
	AssetsModule,
	ThemingModule,
	MarkdownParserModule,
	FluxModule,
	APIModule,
	ClydeModule
};