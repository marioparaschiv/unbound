import type { AddonAuthor, AddonManifest, Theme } from '@unbound-app/types';

import { getLoader, getThemes, rescanThemes } from '~/native/unbound-native';
import type { Addon, AddonResolveable } from '~/addons/addon';
import { parseThemeBundle } from '~/themes/bundle';
import { Addons } from '~/addons/addons';
import ThemeStore from '~/themes/state';
import { Users } from '~/metro/stores';

/** The name and description the theme editor saves into a theme's manifest. */
export type LocalThemeDetails = {
	name: string;
	description: string;
};

const FALLBACK_AUTHOR: AddonAuthor = { name: 'Unbound', id: '0' };

// A hot reload persists the pushed theme, so it rewrites the files on disk like an update.
const DISK_EVENTS = ['installed', 'updated', 'uninstalled', 'reloaded'] as const;

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
			noun: 'UNBOUND_THEMES_NOUN',
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
	 * @description Saves a theme editor draft as an installed theme, then applies it. Saving the same id again overwrites it.
	 * @param id The theme's local id.
	 * @param theme The draft, written as the theme's bundle.
	 * @param details The name and description for its manifest.
	 * @returns Whether the theme saved and applied.
	 */
	async saveLocal(id: string, theme: Theme, details: LocalThemeDetails): Promise<boolean> {
		const user = Users?.getCurrentUser?.();
		const manifest: AddonManifest = {
			version: '1.0.0',
			authors: [user ? { name: user.username, id: user.id } : FALLBACK_AUTHOR],
			...this.getAddon(id)?.manifest,
			id,
			type: 'theme',
			name: details.name,
			description: details.description,
			main: 'bundle.json',
		};

		// A failed earlier save would otherwise read as this save's failure.
		this.errors.delete(id);

		const result = await this.reload(id, JSON.stringify(theme), manifest);

		if (!result.ok) {
			return false;
		}

		await this.enable(id);

		return !this.errors.has(id);
	}

	/**
	 * @description Reports whether a theme reaches native views only after a restart. Applying is live, but a loader
	 * without `rescanThemes` recolours native views from the theme files it scanned at launch, so a theme installed or changed since lags.
	 * @param addon The theme id or addon.
	 * @returns Whether the loader's launch copy of the theme is missing or differs.
	 */
	needsRestart(addon: AddonResolveable<Theme>): boolean {
		const resolved = this.resolve(addon);

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
