import type {
	FontEntity,
	UnboundDiscordFamily,
	UnboundFontInstallResult,
	UnboundFontPreset,
	UnboundFontPresetResult,
	UnboundFontVariant,
	UnboundResolvedFont,
} from '@unbound-app/types';
import type { AddonVersion, ListedAddon } from '@unbound-app/contracts/addons';
import { CORE_SETTINGS_STORE } from '@unbound-app/types/settings';
import toError from '@unbound-app/utils/to-error';

import { presetCopy, sourceLink, sourceOrigin, type PastedPreset } from '~/fonts/sources';
import { getNativeFonts } from '~/native/unbound-native';
import { Manager } from '~/addons/manager';
import { API_URL } from '~/core/constants';
import { Constants } from '~/metro/common';
import { getBucket } from '~/storage/api';

type FontsEvents = {
	changed: () => void;
};

/** A semantic override target: a Discord font group and the families it holds. */
export type FontTarget = {
	group: string;
	families: string[];
};

/** The installed faces of one family, which the override picker offers as one choice. */
export type FontFamily = {
	family: string;
	faces: FontEntity[];
};

/** The core setting the overrides lived in before the loader's font store; the loader migrates it. */
const LEGACY_OVERRIDES = 'font-states';

/**
 * @description Manages custom fonts through `UnboundNative.fonts`. The loader resolves, downloads,
 * checks, installs and applies fonts and keeps their state; this manager mirrors its list for the
 * UI and calls its actions. It patches nothing in JS.
 */
export class Fonts extends Manager<FontEntity, FontsEvents> {
	private overrides: Record<string, string> = {};
	// The overrides this JS run started with; text laid out since keeps them until a restart.
	private launched: Record<string, string> = {};
	private families: Record<string, UnboundDiscordFamily> = {};

	constructor() {
		super({
			kind: 'font',
			name: 'Fonts',
			directory: 'Unbound/Fonts',
			bucket: 'fonts',
			label: 'UNBOUND_FONTS',
			noun: 'UNBOUND_FONTS_NOUN',
			icon: 'LettersIcon',
		});
	}

	initialize() {
		const bridge = getNativeFonts();

		if (!bridge) return;

		const constants: Record<string, string> = {};

		for (const [key, value] of Object.entries<unknown>(Constants.Fonts ?? {})) {
			if (typeof value === 'string') {
				constants[key] = value;
			}
		}

		bridge.setTargets(constants, { api: API_URL });
		getBucket(CORE_SETTINGS_STORE).remove(LEGACY_OVERRIDES);
		this.refresh();
		this.launched = this.overrides;
	}

	/** @returns Whether the loader has the font store; an older one needs an update first. */
	isSupported(): boolean {
		return Boolean(getNativeFonts());
	}

	/** @returns The installed faces grouped by family, families in name order. */
	getFamilies(): FontFamily[] {
		const families = new Map<string, FontEntity[]>();

		for (const font of this.getAddons()) {
			families.set(font.family, [...(families.get(font.family) ?? []), font]);
		}

		return [...families.entries()]
			.map(([family, faces]) => ({
				family,
				faces: faces.sort((a, b) => a.weight - b.weight),
			}))
			.sort((a, b) => a.family.localeCompare(b.family));
	}

	/** @returns Discord's font groups (PRIMARY, DISPLAY, CODE, ...) and the families each holds. */
	getTargets(): FontTarget[] {
		const groups = new Map<string, string[]>();

		for (const [family, discord] of Object.entries(this.families)) {
			for (const group of discord.groups) {
				groups.set(group, [...(groups.get(group) ?? []), family]);
			}
		}

		return [...groups.entries()].map(([group, families]) => ({ group, families }));
	}

	/** @returns The override map, Discord family to face id. */
	getOverrides(): Record<string, string> {
		return this.overrides;
	}

	/**
	 * @description Reads which installed families a Discord font group's weights use.
	 * @param group A group such as `PRIMARY`.
	 * @returns The family names, none when the group keeps Discord's fonts.
	 */
	getGroupFamilies(group: string): string[] {
		const names = new Set<string>();

		for (const [family, discord] of Object.entries(this.families)) {
			const id = discord.groups.includes(group) ? this.overrides[family] : undefined;
			const font = id ? this.getAddon(id) : undefined;

			if (font) {
				names.add(font.family);
			}
		}

		return [...names];
	}

	/**
	 * @description Reads whether the overrides changed since this JS run started. Text already laid out
	 * keeps the sizes of the fonts it was measured with, so a change shows fully only after a restart.
	 * @returns Whether a restart is needed to apply the overrides everywhere.
	 */
	needsRestart(): boolean {
		const current = Object.entries(this.overrides);

		return (
			current.length !== Object.keys(this.launched).length ||
			current.some(([family, id]) => this.launched[family] !== id)
		);
	}

	getPresets(): UnboundFontPreset[] {
		return getNativeFonts()?.listPresets() ?? [];
	}

	/**
	 * @description Resolves a family name or link to its provider's files, for the variant picker.
	 * @param input The family name or link.
	 * @returns The resolved font, or `undefined` with the failure in `errors` under `input`.
	 */
	async resolve(input: string): Promise<UnboundResolvedFont | undefined> {
		try {
			return await this.bridge().resolve(input);
		} catch (error) {
			this.logger.error(`Failed to resolve font ${input}:`, error);
			this.errors.set(input, toError(error));

			return undefined;
		}
	}

	/**
	 * @description Installs a font by family name or link and emits `changed`. Twin of {@link delete}.
	 * @param input The family name or link.
	 * @param variants The weights and styles to install; every file when omitted.
	 * @returns What installed, or `undefined` with the failure in `errors` under `input`.
	 */
	async install(
		input: string,
		variants?: UnboundFontVariant[],
	): Promise<UnboundFontInstallResult | undefined> {
		try {
			const result = await this.bridge().install(input, variants);

			this.refresh();

			return result;
		} catch (error) {
			this.logger.error(`Failed to install font ${input}:`, error);
			this.errors.set(input, toError(error));

			return undefined;
		}
	}

	/**
	 * @description Removes an installed face, and every override pointing at it, and emits `changed`.
	 * Twin of {@link install}.
	 * @param id The face id.
	 */
	async delete(id: string): Promise<void> {
		try {
			await this.bridge().remove(id);

			this.refresh();
		} catch (error) {
			this.logger.error(`Failed to delete font ${id}:`, error);
			this.errors.set(id, toError(error));
		}
	}

	/**
	 * @description Points a Discord family, or every family of a group, at a face and emits `changed`.
	 * A group takes the face of the same family closest to each weight. Twin of {@link clearOverride}.
	 * @param key A Discord family such as `ggsans-Bold`, or a group such as `PRIMARY`.
	 * @param fontId The face id.
	 */
	async setOverride(key: string, fontId: string): Promise<void> {
		try {
			await this.bridge().setOverride(key, fontId);

			this.refresh();
		} catch (error) {
			this.logger.error(`Failed to set font override ${key}:`, error);
			this.errors.set(key, toError(error));
		}
	}

	/**
	 * @description Gives a Discord family, or every family of a group, back its own font and emits
	 * `changed`. Twin of {@link setOverride}.
	 * @param key A Discord family or a group.
	 */
	async clearOverride(key: string): Promise<void> {
		try {
			await this.bridge().setOverride(key, null);

			this.refresh();
		} catch (error) {
			this.logger.error(`Failed to clear font override ${key}:`, error);
			this.errors.set(key, toError(error));
		}
	}

	/**
	 * @description Makes the override map match `overrides`, for Sync. Faces this device lacks stay unset.
	 * @param overrides Discord family to face id.
	 */
	async replaceOverrides(overrides: Record<string, string>): Promise<void> {
		for (const family of Object.keys(this.overrides)) {
			if (!(family in overrides)) {
				await this.clearOverride(family);
			}
		}

		for (const [family, id] of Object.entries(overrides)) {
			if (this.overrides[family] !== id && this.getAddon(id)) {
				await this.setOverride(family, id);
			}
		}
	}

	/**
	 * @description Saves the current overrides as a preset, or a pasted one, and emits `changed`.
	 * Twin of {@link removePreset}.
	 * @param preset A name to snapshot the current overrides under, or a pasted preset.
	 * @returns The saved preset, or `undefined` with the failure in `errors` under its name.
	 */
	async savePreset(preset: string | PastedPreset): Promise<UnboundFontPreset | undefined> {
		const name = typeof preset === 'string' ? preset : preset.name;

		try {
			const saved = await this.bridge().savePreset(
				typeof preset === 'string' ? { name } : preset,
			);

			this.emit('changed');

			return saved;
		} catch (error) {
			this.logger.error(`Failed to save font preset ${name}:`, error);
			this.errors.set(name, toError(error));

			return undefined;
		}
	}

	/**
	 * @description Removes a preset and emits `changed`. Twin of {@link savePreset}.
	 * @param id The preset id.
	 */
	async removePreset(id: string): Promise<void> {
		try {
			await this.bridge().removePreset(id);

			this.emit('changed');
		} catch (error) {
			this.logger.error(`Failed to remove font preset ${id}:`, error);
			this.errors.set(id, toError(error));
		}
	}

	/**
	 * @description Replaces every override with a preset's, downloading the faces it lacks, and emits `changed`.
	 * @param id The preset id.
	 * @returns What applied, or `undefined` with the failure in `errors` under `id`.
	 */
	async applyPreset(id: string): Promise<UnboundFontPresetResult | undefined> {
		try {
			const result = await this.bridge().applyPreset(id);

			this.refresh();

			return result;
		} catch (error) {
			this.logger.error(`Failed to apply font preset ${id}:`, error);
			this.errors.set(id, toError(error));

			return undefined;
		}
	}

	/**
	 * @description Builds the text a preset is shared as.
	 * @param id The preset id.
	 * @returns The JSON text and the families left out for having a local font, or `undefined` for an unknown id.
	 */
	copyPreset(id: string): { text: string; dropped: string[] } | undefined {
		const preset = this.getPresets().find((entry) => entry.id === id);

		return preset ? presetCopy(preset) : undefined;
	}

	/**
	 * @description Reads the link each face installs from again, for Sync. Local faces have none.
	 * @returns A record of face id to link.
	 */
	getSources(): Record<string, string> {
		const sources: Record<string, string> = {};

		for (const font of this.getAddons()) {
			const link = sourceLink(font.source);

			if (link) {
				sources[font.id] = link;
			}
		}

		return sources;
	}

	/**
	 * @description Reads whether a listed font is installed: a face installed from its file.
	 * @param listed The listed font.
	 * @returns The listed version when a face came from its file, otherwise `undefined`.
	 */
	getInstalledVersion(listed: ListedAddon): string | undefined {
		const url = listed.latestVersion.bundleUrl;
		const installed = this.getAddons().some((font) => sourceOrigin(font.source)?.id === url);

		return installed ? listed.latestVersion.version : undefined;
	}

	/**
	 * @description Installs a listed font from its file; fonts carry no manifest, no version to hold and
	 * no on state, so they apply from Design.
	 * @param _listed The listed font.
	 * @param version The version whose file to install.
	 * @returns Whether the install succeeded.
	 */
	async installListed(_listed: Pick<ListedAddon, 'id'>, version: AddonVersion): Promise<boolean> {
		return Boolean(await this.install(version.bundleUrl));
	}

	/**
	 * @description Calls a listener whenever the installed fonts, overrides or presets change.
	 * @param listener The listener.
	 * @returns A function that removes the listener.
	 */
	onInstalledChange(listener: () => void): () => void {
		this.on('changed', listener);

		return () => void this.off('changed', listener);
	}

	// Callers reach this only from the UI, which shows an update prompt when the bridge is missing.
	private bridge() {
		const bridge = getNativeFonts();

		if (!bridge) {
			throw new Error('This loader has no font store; update the loader.');
		}

		return bridge;
	}

	private refresh() {
		const list = getNativeFonts()?.list();

		if (!list) return;

		this.addons.clear();

		for (const font of list.fonts) {
			this.addons.set(font.id, font);
		}

		this.overrides = list.overrides;
		this.families = list.families;
		this.emit('changed');
	}
}

/** @internal */
export const fonts = new Fonts();
