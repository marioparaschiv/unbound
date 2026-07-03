import type { FontEntity } from '@unbound-app/types';

import { Manager, ManagerType } from '~/managers/base';
import { Constants } from '~/api/metro/common';
import storage from '~/api/storage';
import fs from '~/api/fs';

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
		super(ManagerType.FONTS);
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
		return storage.get('unbound', 'font-states', {} as Record<string, string>);
	}

	/**
	 * @description Sets one font override and emits `changed`.
	 * @param family The Discord font family to override.
	 * @param name The custom or system font name to use instead.
	 */
	setOverride(family: string, name: string) {
		const states = this.getOverrides();
		states[family] = name;
		storage.set('unbound', 'font-states', states);
		this.emit('changed');
	}

	/**
	 * @description Clears one font override and emits `changed`.
	 * @param family The Discord font family to reset.
	 */
	clearOverride(family: string) {
		const states = this.getOverrides();
		delete states[family];
		storage.set('unbound', 'font-states', states);
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
			const file = url.split('/').pop() ?? `font-${Date.now()}.ttf`;
			const data = await fetch(url, { cache: 'no-cache' }).then((res) => {
				if (!res.ok) throw new Error(`Failed to fetch font (${res.status}).`);
				return res.arrayBuffer();
			});

			const base64 = Buffer.from(data).toString('base64');
			await fs.write(`Unbound/Fonts/${file}`, base64, 'base64');

			this.emit('changed');
			return file;
		} catch (error: any) {
			this.logger.error('Failed to install font:', error);
			return undefined;
		}
	}
}

export const fonts = new Fonts();
