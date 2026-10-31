import type { AddonVersion, ListedAddon } from '@unbound-app/contracts/addons';
import type { FontEntity } from '@unbound-app/types';

import { getSetting, setSetting } from '~/settings/unbound';
import { safeFontFileName } from '~/addons/paths';
import { Manager } from '~/addons/manager';
import { Constants } from '~/metro/common';
import fs from '~/native/fs';

type FontsEvents = {
	changed: () => void;
};

/** A semantic override target: a Discord font group and the underlying families it maps to. */
export type FontTarget = {
	group: string;
	families: string[];
};

/**
 * @description Manages custom fonts. The native layer applies fonts by reading the `font-states`
 * setting and hooking the platform font loader; this manager only lists fonts and writes that
 * setting. It patches nothing in JS.
 */
export class Fonts extends Manager<FontEntity, FontsEvents> {
	constructor() {
		super({
			kind: 'font',
			name: 'Fonts',
			directory: 'Unbound/Fonts',
			bucket: 'fonts',
			label: 'UNBOUND_FONTS',
			icon: 'LettersIcon',
		});

		Manager.register('font', this);
	}

	initialize() {
		for (const font of window.UNBOUND_FONTS ?? []) {
			this.entities.set(font.name, font);
		}

		this.initialized = true;
	}

	/** @returns The installed custom fonts. */
	getFonts(): FontEntity[] {
		return this.getEntities();
	}

	/** @returns The system font family names available to override with. */
	getAvailableFonts(): string[] {
		return window.UNBOUND_AVAILABLE_FONTS ?? [];
	}

	/**
	 * @description Derives the override targets from Discord's live `Constants.Fonts` map, grouped by
	 * semantic prefix (PRIMARY, DISPLAY, CODE, GINTO). Values are the underlying family names.
	 * @returns The semantic-grouped override targets.
	 */
	getTargets(): FontTarget[] {
		const map: Record<string, Set<string>> = {};

		for (const [key, value] of Object.entries<string>(Constants.Fonts)) {
			const group = key.split('_')[0];
			const families = String(value)
				.split(',')
				.map((f) => f.trim());

			map[group] ??= new Set();

			for (const family of families) map[group].add(family);
		}

		return Object.entries(map).map(([group, families]) => ({ group, families: [...families] }));
	}

	/** @returns The current override map (`{ [family]: overrideName }`). */
	getOverrides(): Record<string, string> {
		return getSetting('font-states');
	}

	/**
	 * @description Sets one font override and emits `changed`.
	 * @param family The Discord font family to override.
	 * @param name The custom or system font name to use instead.
	 */
	setOverride(family: string, name: string) {
		setSetting('font-states', { ...this.getOverrides(), [family]: name });
		this.emit('changed');
	}

	/**
	 * @description Clears one font override and emits `changed`.
	 * @param family The Discord font family to reset.
	 */
	clearOverride(family: string) {
		const { [family]: removed, ...states } = this.getOverrides();

		setSetting('font-states', states);
		this.emit('changed');
	}

	/**
	 * @description Overrides every font via the native `"*"` wildcard and emits `changed`.
	 * @param name The font name to apply everywhere.
	 */
	setOverrideAll(name: string) {
		this.setOverride('*', name);
	}

	/** @description Clears the wildcard override and emits `changed`. */
	clearOverrideAll() {
		this.clearOverride('*');
	}

	/**
	 * @description Installs a font from a URL: saves the file to the Fonts folder. The native side
	 * registers it and re-injects `UNBOUND_FONTS`; the new font appears after that push or a relaunch.
	 * @param url The font file URL.
	 * @returns The saved file name, or `undefined` on failure.
	 */
	async install(url: string): Promise<string | undefined> {
		try {
			const file = safeFontFileName(url, `font-${Date.now()}.ttf`);

			const data = await fetch(url, { cache: 'no-cache' }).then((res) => {
				if (!res.ok) {
					throw new Error(`Failed to fetch font (${res.status}).`);
				}

				return res.arrayBuffer();
			});

			const base64 = Buffer.from(data).toString('base64');

			await fs.writeFile(`${this.directory}/${file}`, base64, 'base64');

			this.recordSource(file, url);
			this.emit('changed');

			return file;
		} catch (error) {
			this.logger.error('Failed to install font:', error);

			return undefined;
		}
	}

	/**
	 * @description Reads whether a listed font is installed. A font installs as its bare file, named after the bundle, with no manifest to version it.
	 * @param listed The listed font.
	 * @returns The listed version when its file is installed, otherwise `undefined`.
	 */
	getInstalledVersion(listed: ListedAddon): string | undefined {
		const file = listed.latestVersion.bundleUrl.split('/').pop() ?? '';
		const installed = this.getEntities().some((font) => font.file === file);

		return installed ? listed.latestVersion.version : undefined;
	}

	/**
	 * @description Installs a listed font as its bare file; fonts carry no manifest, and no version to hold.
	 * @param _listed The listed font.
	 * @param version The version whose file to install.
	 * @returns Whether the install succeeded.
	 */
	async installListed(_listed: ListedAddon, version: AddonVersion): Promise<boolean> {
		return Boolean(await this.install(version.bundleUrl));
	}

	/**
	 * @description Calls a listener whenever a font is installed or deleted.
	 * @param listener The listener.
	 * @returns A function that removes the listener.
	 */
	onInstalledChange(listener: () => void): () => void {
		this.on('changed', listener);

		return () => void this.off('changed', listener);
	}

	/**
	 * @description Deletes an installed font file and emits `changed`. Twin of {@link install}. The
	 * native side drops it from `UNBOUND_FONTS` on the next push or relaunch.
	 * @param file The installed file name, as {@link install} returned it.
	 */
	async delete(file: string): Promise<void> {
		try {
			await fs.removeFile(`${this.directory}/${file}`);

			for (const font of this.getEntities()) {
				if (font.file === file) {
					this.entities.delete(font.name);
				}
			}

			this.forgetSource(file);
			this.emit('changed');
		} catch (error) {
			this.logger.error(`Failed to delete font ${file}:`, error);
		}
	}
}

/** @internal */
export const fonts = new Fonts();
