import type { Addon, AddonManifest } from '@unbound-app/types';
import noop from '@unbound-app/utils/noop';

import storage from '~/api/storage';

import { Manager } from './base';

type AddonResolveable = string | Addon;

type AddonEvents<T extends Addon> = {
	loaded: (entity: T) => void;
	unloaded: (entity: T) => void;
	started: (entity: T) => void;
	stopped: (entity: T) => void;
	enabled: (entity: T) => void;
	disabled: (entity: T) => void;
	toggled: (entity: T) => void;
	reloaded: (entity: T) => void;
};

export abstract class Addons<T extends Addon> extends Manager<T, AddonEvents<T>> {
	protected abstract handleBundle(bundle: string): any;

	load(bundle: string, manifest: AddonManifest) {
		try {
			this.validateManifest(manifest);

			const entity = {
				id: manifest.id,
				data: manifest,
				bundle,
				instance: null,
				started: false,
				failed: false,
			} as unknown as T;

			this.entities.set(manifest.id, entity);

			const states = this.getStates();
			if (states[manifest.id]) {
				this.start(entity);
			}

			this.emit('loaded', entity);
		} catch (error: any) {
			this.logger.error(`Failed to load addon ${manifest.id}:`, error);
			this.errors.set(manifest.id, error);
		}
	}

	unload(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		try {
			if (resolved.started) {
				this.stop(resolved);
			}

			this.entities.delete(resolved.id);
			this.errors.delete(resolved.id);

			this.emit('unloaded', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to unload addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}

	start(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved || resolved.started) return;

		try {
			const recoveryMode = storage.get('unbound', 'recovery', false);

			if (recoveryMode) {
				resolved.instance = { start: noop, stop: noop };
			} else {
				const instance = this.handleBundle((resolved as any).bundle);
				resolved.instance = instance;
			}

			resolved.instance?.start?.();
			resolved.started = true;

			this.emit('started', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to start addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
			resolved.failed = true;
		}
	}

	stop(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved || !resolved.started) return;

		try {
			resolved.instance?.stop?.();
			resolved.instance = null;
			resolved.started = false;

			this.emit('stopped', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to stop addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}

	enable(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		try {
			const states = this.getStates();
			states[resolved.id] = true;
			this.settings.set('states', states);

			if (!resolved.started) {
				this.start(resolved);
			}

			this.emit('enabled', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to enable addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}

	disable(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		try {
			const states = this.getStates();
			states[resolved.id] = false;
			this.settings.set('states', states);

			if (resolved.started) {
				this.stop(resolved);
			}

			this.emit('disabled', resolved);
		} catch (error: any) {
			this.logger.error(`Failed to disable addon ${resolved.id}:`, error);
			this.errors.set(resolved.id, error);
		}
	}

	toggle(entity: AddonResolveable) {
		const resolved = this.resolve(entity);
		if (!resolved) return;

		const states = this.getStates();
		if (states[resolved.id]) {
			this.disable(resolved);
		} else {
			this.enable(resolved);
		}

		this.emit('toggled', resolved);
	}

	protected resolve(entity: AddonResolveable): T | undefined {
		if (typeof entity === 'string') {
			return this.entities.get(entity) ?? this.getByName(entity);
		}

		return entity as T;
	}

	protected getByName(name: string): T | undefined {
		for (const entity of this.entities.values()) {
			if (entity.data.name === name) {
				return entity;
			}
		}
	}

	protected getStates(): Record<string, boolean> {
		return this.settings.get('states', {});
	}

	protected validateManifest(manifest: AddonManifest) {
		const required = ['id', 'name', 'description', 'authors', 'version', 'main'];

		for (const field of required) {
			if (!(field in manifest) || manifest[field as keyof AddonManifest] === undefined) {
				throw new Error(`Manifest missing required field: ${field}`);
			}
		}

		if (!Array.isArray(manifest.authors) || manifest.authors.length === 0) {
			throw new Error('Manifest authors must be a non-empty array');
		}
	}
}
