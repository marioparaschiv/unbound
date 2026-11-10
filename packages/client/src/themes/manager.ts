import type { Theme } from '@unbound-app/types';

import { getLoader, getThemes, rescanThemes } from '~/native/unbound-native';
import type { Addon, AddonResolveable } from '~/addons/addon';
import { parseThemeBundle } from '~/themes/bundle';
import { Addons } from '~/addons/addons';
import ThemeStore from '~/themes/state';

// A hot reload persists the pushed theme, so it rewrites the files on disk like an update.
const DISK_EVENTS = ['installed', 'updated', 'deleted', 'reloaded'] as const;

/**
 * @description Manages user themes, layering theme-specific application on top of the base {@link Addons} manager.
 * One theme applies at a time; the applied one is shown through {@link ThemeStore}.
 */
export class Themes extends Addons<Theme> {
	protected readonly selection = 'one';

	constructor() {
		super({
			kind: 'theme',
			name: 'Themes',
			directory: 'Unbound/Themes',
			bucket: 'themes',
			label: 'UNBOUND_THEMES',
			icon: 'PaintPaletteIcon',
		});

		// The loader recolours native views from the theme files it scanned, so each change on disk rescans them.
		for (const event of DISK_EVENTS) {
			this.on(event, rescanThemes);
		}
	}

	/**
	 * @description Loads every theme the loader scanned (`UnboundNative.getThemes()`); the applied one starts and shows as it loads.
	 */
	initialize() {
		for (const { bundle, manifest } of getThemes()) {
			this.load(bundle, manifest);
		}
	}

	/**
	 * @description Parses a theme bundle into its {@link Theme} definition.
	 * @param bundle The raw theme bundle to parse.
	 * @returns The parsed theme.
	 */
	protected handleBundle(bundle: string): Theme {
		return parseThemeBundle(bundle);
	}

	/**
	 * @description Shows the applied theme, replacing the one before. Twin of {@link unapply}.
	 * @param theme The applied theme.
	 */
	protected apply(theme: Addon<Theme>): void {
		ThemeStore.getState().setApplied(theme.id, this.stateOf(theme).instance);
	}

	/**
	 * @description Brings back Discord's own theme. Twin of {@link apply}.
	 */
	protected unapply(): void {
		ThemeStore.getState().setApplied(null, null);
	}

	/**
	 * @description Reports whether a theme reaches native views only after a restart. Applying is live, but a loader
	 * without `rescanThemes` recolours native views from the theme files it scanned at launch, so a theme installed or changed since lags.
	 * @param entity The theme id or entity.
	 * @returns Whether the loader's launch copy of the theme is missing or differs.
	 */
	needsRestart(entity: AddonResolveable<Theme>): boolean {
		const resolved = this.resolve(entity);

		if (!resolved || !getLoader()) {
			return false;
		}

		return !getThemes().some(
			({ bundle, manifest }) => manifest.id === resolved.id && bundle === resolved.bundle,
		);
	}
}

/** @internal */
export const themes = new Themes();
