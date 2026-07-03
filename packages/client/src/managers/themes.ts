import type { Theme, ThemeEntity } from '@unbound-app/types';

import { ManagerType } from '~/managers/base';
import { Addons } from '~/managers/addons';
import ThemeStore from '~/stores/themes';

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
		} catch (error: any) {
			this.logger.error(`Failed to enable theme ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
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
		} catch (error: any) {
			this.logger.error(`Failed to disable theme ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}
}

export const themes = new Themes();
