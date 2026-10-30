import type { Theme, ThemeEntity } from '@unbound-app/types';
import toError from '@unbound-app/utils/to-error';

import { parseThemeBundle } from '~/lib/theme-bundle';
import { Addons } from '~/managers/addons';
import ThemeStore from '~/stores/themes';

/**
 * @description Manages user themes, layering theme-specific application on top of the base {@link Addons} manager.
 * Loads bundled themes at startup and applies the selected one through {@link ThemeStore} and the `applied` setting.
 */
export class Themes extends Addons<ThemeEntity> {
	/**
	 * @description Creates the themes manager bound to the {@link 'themes'} type.
	 */
	constructor() {
		super('themes');
	}

	/**
	 * @description Loads every theme exposed on `window.UNBOUND_THEMES`, then marks the manager initialised.
	 */
	initialize() {
		for (const { bundle, manifest } of window.UNBOUND_THEMES ?? []) {
			this.load(bundle, manifest);
		}

		const appliedId = this.getAppliedId();
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
		return parseThemeBundle(bundle);
	}

	protected get entityType() {
		return 'theme' as const;
	}

	/**
	 * @description Reads which theme is applied.
	 * @returns The applied theme's id, or `null` when Discord's own theme is in use.
	 */
	getAppliedId(): string | null {
		return this.settings.get<string | null>('applied', null);
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
			const prev = this.getAppliedId();

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
