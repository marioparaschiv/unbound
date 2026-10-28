import type { AddonAuthor, AddonManifest, Theme, ThemeEntity } from '@unbound-app/types';
import toError from '@unbound-app/utils/to-error';

import type { LocalThemeId } from '~/lib/local-themes';
import { ManagerType } from '~/managers/base';
import { Users } from '~/api/metro/stores';
import { Addons } from '~/managers/addons';
import ThemeStore from '~/stores/themes';

/** The name and description a theme editor session saves into the manifest. */
export type LocalThemeDetails = {
	name: string;
	description: string;
};

const FALLBACK_AUTHOR: AddonAuthor = { name: 'Unbound', id: '0' };

/**
 * @description Manages user themes, layering theme-specific application on top of the base {@link Addons} manager.
 * Loads bundled themes at startup and applies the selected one through {@link ThemeStore} and the `applied` setting.
 */
export class Themes extends Addons<ThemeEntity> {
	/**
	 * @description Creates the themes manager bound to the {@link ManagerType.THEMES} type.
	 */
	constructor() {
		super(ManagerType.THEMES);
	}

	/**
	 * @description Loads every theme exposed on `window.UNBOUND_THEMES`, then marks the manager initialised.
	 */
	initialize() {
		for (const { bundle, manifest } of window.UNBOUND_THEMES ?? []) {
			this.load(bundle, manifest);
		}

		const appliedId = this.settings.get('applied', null);
		const applied = appliedId ? this.getEntity(appliedId) : undefined;

		if (applied?.started) {
			ThemeStore.getState().setApplied(applied.id, applied.instance);
		}

		this.initialized = true;
	}

	/**
	 * @description Parses a theme bundle into its {@link Theme} definition.
	 * @param bundle The raw theme bundle to parse.
	 * @returns The parsed theme.
	 */
	protected handleBundle(bundle: string): Theme {
		return JSON.parse(bundle);
	}

	protected get entityType() {
		return 'theme' as const;
	}

	/**
	 * @description Enables a theme, overriding the base implementation: stops any previously applied theme, records
	 * this one as `applied`, starts it if needed, and pushes it onto {@link ThemeStore}. Twin of {@link disable}.
	 * @param entity The theme id or entity to enable.
	 */
	enable(entity: string | ThemeEntity) {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		try {
			const prev = this.settings.get('applied', null);

			if (prev && prev !== resolved.id) {
				const prevEntity = this.getEntity(prev);

				if (prevEntity && prevEntity.started) {
					this.stop(prevEntity);
				}
			}

			this.settings.set('applied', resolved.id);

			const states = this.getStates();

			states[resolved.id] = true;
			this.settings.set('states', states);

			if (!resolved.started) {
				this.start(resolved);
			}

			ThemeStore.getState().setApplied(resolved.id, resolved.instance);
			this.emit('enabled', resolved);
		} catch (error) {
			this.logger.error(`Failed to enable theme ${resolved.id}:`, error);
			this.errors.set(resolved.id, toError(error));
		}
	}

	/**
	 * @description Saves a theme editor draft as a theme on disk, loads or hot-swaps it, then applies it.
	 * @param id The session's local id; saving the same id again overwrites the same theme.
	 * @param theme The draft, written verbatim as `bundle.json`.
	 * @param details The name and description for the manifest.
	 * @returns The saved, applied theme, or `undefined` when saving failed (logged and recorded in `errors`).
	 */
	async saveLocal(
		id: LocalThemeId,
		theme: Theme,
		details: LocalThemeDetails,
	): Promise<ThemeEntity | undefined> {
		// reload() reads this id's recorded error as its own, so a failed earlier save would fail every retry.
		this.errors.delete(id);

		const result = await this.reload(
			id,
			JSON.stringify(theme),
			this.localManifest(id, details),
		);

		if (!result.ok) return;

		this.enable(id);

		if (this.errors.has(id)) return;

		return this.getEntity(id);
	}

	private localManifest(id: LocalThemeId, details: LocalThemeDetails): AddonManifest {
		const existing = this.getEntity(id)?.data;
		const user = Users.getCurrentUser?.();
		const author: AddonAuthor = user ? { name: user.username, id: user.id } : FALLBACK_AUTHOR;

		return {
			icon: '',
			updates: '',
			folder: '',
			path: '',
			url: '',
			version: '1.0.0',
			authors: [author],
			...existing,
			id,
			type: 'theme',
			name: details.name,
			description: details.description,
			// The native loader only reads `bundle.json`.
			main: 'bundle.json',
		};
	}

	/**
	 * @description Disables a theme, overriding the base implementation: clears the `applied` setting, stops the
	 * theme if running, and clears it from {@link ThemeStore}. Twin of {@link enable}.
	 * @param entity The theme id or entity to disable.
	 */
	disable(entity: string | ThemeEntity) {
		const resolved = this.resolve(entity);

		if (!resolved) return;

		try {
			this.settings.set('applied', null);

			const states = this.getStates();

			states[resolved.id] = false;
			this.settings.set('states', states);

			if (resolved.started) {
				this.stop(resolved);
			}

			ThemeStore.getState().setApplied(null, null);
			this.emit('disabled', resolved);
		} catch (error) {
			this.logger.error(`Failed to disable theme ${resolved.id}:`, error);
			this.errors.set(resolved.id, toError(error));
		}
	}
}

/** @internal */
export const themes = new Themes();
