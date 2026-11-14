import { parseIdList } from '@unbound-plugins/shared/entities/id-list';
import type { AnyProps } from '@unbound-app/api/metro';
import { flux, metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { addFavorites, removeFavorite, withLocalFavorites, type Favorite } from '~/lib/favorites';

const LIMIT_KEYS = ['FREE_FAVORITE_LIMIT', 'MAX_FAVORITE_CHANNELS'] as const;

function localFavorites(): string[] {
	return settings.localFavorites ? parseIdList(settings.favorites) : [];
}

function channelType(id: string): number {
	return flux.getStore('Channel').getChannel(id)?.type ?? 0;
}

function patchStore() {
	const FavoriteStore = flux.getStore('Favorite') as AnyProps | undefined;
	const proto: AnyProps | undefined = FavoriteStore
		? Object.getPrototypeOf(FavoriteStore)
		: undefined;

	if (!FavoriteStore || typeof proto?.getFavoriteChannels !== 'function') {
		logger.warn('Local favorites skipped: Discord moved FavoriteStore.');

		return;
	}

	let base: unknown;
	let ids = '';
	let merged: Record<string, Favorite> = {};

	patcher.after(proto, 'getFavoriteChannels', ({ result }) => {
		const local = localFavorites();

		if (!local.length) return result;

		if (result !== base || settings.favorites !== ids) {
			base = result;
			ids = settings.favorites;
			merged = withLocalFavorites(result as Record<string, Favorite>, local, channelType);
		}

		return merged;
	});
	patcher.after(
		proto,
		'getFavorite',
		({ args: [id], result }) =>
			result ?? (localFavorites().includes(id as string) ? merged[id as string] : undefined),
	);
	patcher.after(
		proto,
		'isFavorite',
		({ args: [id], result }) => result || localFavorites().includes(id as string),
	);
	FavoriteStore.emitChange?.();
}

function patchActions() {
	const Actions = metro.findByProps('addFavoriteChannels', 'removeFavoriteChannel');

	if (!Actions) {
		logger.warn('Local favorites skipped: Discord moved addFavoriteChannels.');

		return;
	}

	patcher.instead(Actions, 'addFavoriteChannels', ({ args, original, this: self }) => {
		const options = args[0] as { channelIds?: string[] } | undefined;

		if (!settings.localFavorites || !options?.channelIds) return original.apply(self, args);

		settings.favorites = addFavorites(settings.favorites, options.channelIds);
		flux.getStore('Favorite').emitChange?.();
	});
	patcher.instead(Actions, 'removeFavoriteChannel', ({ args, original, this: self }) => {
		const id = args[0] as string;

		if (!parseIdList(settings.favorites).includes(id)) return original.apply(self, args);

		settings.favorites = removeFavorite(settings.favorites, id);
		flux.getStore('Favorite').emitChange?.();
	});
}

function liftLimits(): () => void {
	const restores: (() => void)[] = [];

	for (const key of LIMIT_KEYS) {
		const Limits = metro.findByProps(key);

		if (!Limits || typeof Limits[key] !== 'number') continue;

		const limit: number = Limits[key];

		Limits[key] = settings.localFavorites ? Infinity : limit;
		restores.push(() => {
			Limits[key] = limit;
		});
	}

	return () => {
		for (const restore of restores) restore();
	};
}

/**
 * @description Keeps favorite channels on this device past Discord's limit while the setting is on, by patching `FavoriteStore`
 * and the favorite actions and lifting the limit constants.
 * @returns A function that restores the limits.
 */
export function patchLocalFavorites(): () => void {
	patchStore();
	patchActions();

	return liftLimits();
}

export default patchLocalFavorites;
