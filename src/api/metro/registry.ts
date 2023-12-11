import { bulk } from '@metro';
import { byProps, byName, byStore } from '@metro/filters';
import type { BulkItem, PropertyRecordOrArray } from '@typings/api/metro';
import type { Common } from '@typings/api/metro/common';

type Module<TProps extends string> = PropertyRecordOrArray<TProps[], TProps>
type Store<TName extends string> = Module<`get${TName}` | `get${TName}s`>;

/**
 * NOTE:
 * For some reason you can only ever export up to 3 modules at once using bulk?
 * This issue is more than just "we're loading too fast let's lazy load it" I think
 */
const bulkLazy = (...items: BulkItem[]) => {
	let res = new Array(items.length).fill({ __defined__: false });

	const initializeModules = () => {
		res = bulk(...items);
	};

	return new Array(items.length).fill(0).map((_, i) => (
		new Proxy(
			{
				__METRO_LAZY__: true,
				get module() {
					return res[i];
				}
			} as AnyProps, {
			get(_, prop) {
				if (!prop || typeof prop !== 'string') return;
				if (!res[i]?.__defined__) initializeModules();

				if (prop === 'module') {
					return res[i];
				}

				return res[i]?.[prop];
			}
		})
	));
};

// API
export const [
	Linking,
	AsyncUsers,
	Profiles,
] = bulkLazy(
	{ filter: byProps('openURL', 'openDeeplink') },
	{ filter: byProps('fetchProfile') },
	{ filter: byProps('showUserProfile') }
) as [
		Module<'openURL' | 'openDeeplink'>,
		Module<'fetchProfile'>,
		Module<'showUserProfile'>
	];

// Components
export const [
	Redesign,
	Slider,
	HelpMessage
] = bulkLazy(
	{ filter: byProps('SegmentedControl', 'Stack') },
	{ filter: m => m.render?.name === 'SliderComponent' },
	{ filter: byName('HelpMessage') },
) as [
		Module<'SegmentedControl' | 'Stack'>,
		Fn,
		Fn
	];

// Common
export const [
	StyleSheet,
	Dispatcher,
	Constants
] = bulkLazy(
	{ filter: byProps('createStyles') },
	{ filter: byProps('_dispatch') },
	{ filter: byProps('Fonts', 'Endpoints') },
) as [
		Common.StyleSheet,
		Common.Dispatcher,
		Module<'Fonts' | 'Endpoints'>,
	];

export const [
	Theme,
	REST,
	i18n
] = bulkLazy(
	{ filter: byProps('colors', 'meta') },
	{ filter: byProps('getAPIBaseURL') },
	{ filter: byProps('Messages') }
) as [
		Module<'colors' | 'meta'>,
		Module<'getAPIBaseURL'>,
		Module<'Messages'>
	];

export const [
	Reanimated,
	Gestures,
	Flux,
] = bulkLazy(
	{ filter: m => m.useAnimatedStyle && m.withSpring && m.default?.View },
	{ filter: byProps('Gesture', 'GestureDetector', 'createNativeWrapper') },
	{ filter: byProps('Store', 'connectStores') }
) as [
		Common.Reanimated,
		Common.Gestures,
		Common.Flux
	];

export const [
	Media,
	Moment,
	Clipboard
] = bulkLazy(
	{ filter: byProps('openMediaModal') },
	{ filter: byProps('isMoment') },
	{ filter: byProps('setString', 'getString', 'setImage', 'getImage') }
) as [
		Module<'openMediaModal'>,
		Common.Moment,
		Common.Clipboard
	];

// Stores
export const [
	Guilds,
	_Theme,
	Users
] = bulkLazy(
	{ filter: byStore('Guild') },
	{ filter: byStore('Theme') },
	{ filter: byStore('User') }
) as [
		Store<'Guild'>,
		Module<'theme'>,
		Store<'User'> & Module<'getCurrentUser'>
	];