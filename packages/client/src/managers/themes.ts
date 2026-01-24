import type { Theme, ThemeEntity } from '@unbound-app/types';

import { ManagerType } from '~/managers/base';
import { Addons } from '~/managers/addons';
import ThemeStore from '~/stores/themes';

export class Themes extends Addons<ThemeEntity> {
	constructor() {
		super(ManagerType.THEMES);
	}

	initialize() {
		for (const { bundle, manifest } of window.UNBOUND_THEMES ?? []) {
			this.load(bundle, manifest);
		}

		this.initialized = true;
	}

	protected handleBundle(bundle: string): Theme {
		return JSON.parse(bundle);
	}

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
