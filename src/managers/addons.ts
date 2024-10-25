import { ManagerEntity, type ManagerKind, ManagerType, Regex } from '@constants';
import type { Addon, Manifest, Resolveable } from '@typings/managers';
import { createTimeoutSignal } from '@utilities';
import Base from '@managers/base';
import fs from '@api/fs';


class Addons<T extends Addon> extends Base<T> {
	type: ManagerType = ManagerType.ADDON;
	extension: string;
	kind: ManagerKind;
	path: string;

	constructor(kind: ManagerKind) {
		super(kind);

		this.kind = kind;
		this.path = `Unbound/${this.name}`;
	}

	initialize() {
		throw new Error('Not implemented.');
	}

	shutdown() {
		for (const addon of this.entities.values()) {
			try {
				this.unload(addon);
			} catch (e) {
				this.logger.error(`Failed to stop ${addon.id}. Skipping.`, e.message ?? e);
				continue;
			}
		}

		this.initialized = false;
	}

	load(bundle: string, manifest: Manifest): T {
		const data = { failed: false, instance: null };

		try {
			this.validateManifest(manifest);

			const res = this.handleBundle(bundle);
			if (!res) throw new Error('Bundle didn\'t return an instance.');

			data.instance = res;

			if (this.errors.has(manifest.id) || this.errors.has(manifest.path)) {
				this.errors.delete(manifest.id);
				this.errors.delete(manifest.path);
			}
		} catch (error) {
			data.failed = true;
			this.logger.error(`Failed to execute ${manifest.id}:`, error.message);
			this.errors.set(manifest.id ?? manifest.path, error);
		}

		const addon = {
			data: manifest,
			instance: data.instance,
			id: manifest.id,
			failed: data.failed,
			started: false
		} as T;

		this.entities.set(manifest.id, addon);

		if (this.isEnabled(addon.id)) {
			this.start(addon);
		}

		this.emit('loaded', addon);

		return addon;
	}

	unload(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			if (addon.started) {
				this.stop(addon);
			}

			this.entities.delete(addon.id);

			if (this.errors.has(addon.id)) {
				this.errors.delete(addon.id);
			}

			this.emit('unloaded', addon);
		} catch (e) {
			this.logger.error(`FATAL: ${addon.id} was not able to unload properly, a full app restart is recommended.`, e);
		}
	}

	async install(url: string): Promise<boolean> {
		try {
			const manifestRequest = await fetch(url, { cache: 'no-cache', signal: createTimeoutSignal() }).catch((error) => {
				this.logger.error('Failed to fetch manifest URL:', error.message);
				this.emit('install-error', error);
				return null;
			});

			if (!manifestRequest) return false;

			if (!manifestRequest.ok) {
				throw new Error(`Failed to fetch manifest URL (${manifestRequest.status}: ${manifestRequest.statusText ?? 'No status text.'})`);
			}

			const manifest = await manifestRequest.json();

			try {
				this.logger.debug('Validating manifest...');
				this.validateManifest(manifest as Manifest);
				manifest.url = url;
			} catch (error) {
				this.logger.error('Failed to validate manifest:', error.message);
				this.emit('install-error', error);
				return false;
			}

			if (manifest.type !== ManagerEntity[this.kind]) {
				throw new Error(`You can only install addons of type ${ManagerEntity[this.kind]}.`);
			}

			// Replace manifest.json at the end of the URL with the relative bundle file
			const origin = url.split('/');
			origin.pop();
			const main = new URL(manifest.main, origin.join('/'));

			const bundleRequest = await fetch(main, { cache: 'no-cache', signal: createTimeoutSignal() }).catch((error) => {
				this.logger.error('Failed to fetch bundle URL:', error.message);
				this.emit('install-error', error);
				return null;
			});

			if (!bundleRequest) return false;

			if (!bundleRequest.ok) {
				throw new Error(`Failed to fetch bundle URL (${bundleRequest.status}: ${bundleRequest.statusText ?? 'No status text.'})`);
			}

			const bundle = await bundleRequest.text();
			if (!bundle) throw new Error('Addon bundle was empty.');

			fs.write(`${this.path}/${manifest.id}/bundle.${this.extension}`, bundle);
			fs.write(`${this.path}/${manifest.id}/manifest.json`, JSON.stringify(manifest, null, 2));

			const instance = this.handleBundle(bundle);

			if (this.entities.has(manifest.id)) {
				this.logger.debug(`Unloading existing instance of ${manifest.id}`);
				this.unload(manifest.id);
			}

			const addon = this.load(instance, manifest);
			this.emit('installed', addon);

			return true;
		} catch (error) {
			this.logger.error('Failed to install addon:', error.message);
			this.emit('install-error', error);
			return false;
		}
	}

	async delete(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			this.unload(addon);
			await fs.rm(`${this.path}/${addon.data.id}`);
			this.emit('deleted', addon);
		} catch (e) {
			this.logger.error(`Failed to delete ${addon.data.id}:`, e.message ?? e);
		}
	}

	start(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			addon.instance.start?.();
			addon.started = true;
			this.emit('started', addon);
		} catch (e) {
			this.logger.error(`Failed to start ${addon.data.id}:`, e.message ?? e);
			addon.started = false;
		}
	}

	stop(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			addon.instance.stop?.();
			addon.started = false;
			this.emit('stopped', addon);
		} catch (e) {
			this.logger.error(`Failed to stop ${addon.data.id}:`, e.message ?? e);
			addon.started = true;
		}
	}

	toggle(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		const enabled = this.isEnabled(addon.id);

		if (!enabled) {
			this.enable(addon);
		} else {
			this.disable(addon);
		}

		this.emit('toggled', addon);
	}

	enable(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			const states = this.getStates();

			if (!addon.started) {
				this.start(addon);
			}

			states[addon.id] = true;
			this.settings.set('states', states);
			this.emit('enabled', addon);
		} catch (e) {
			this.logger.error(`Failed to enable ${addon.data.id}:`, e.message ?? e);
		}
	}

	disable(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			const states = this.getStates();

			if (addon.started) {
				this.stop(addon);
			}

			states[addon.id] = false;
			this.settings.set('states', states);
			this.emit('disabled', addon);
		} catch (e) {
			this.logger.error(`Failed to disable ${addon.data.id}:`, e.message ?? e);
		}
	}

	handleBundle(bundle: string) {
		return bundle;
	}

	validateManifest(manifest: Manifest) {
		if (!manifest.name || typeof manifest.name !== 'string') {
			throw new Error('Manifest property "name" must be of type string.');
		} else if (!manifest.description || typeof manifest.description !== 'string') {
			throw new Error('Manifest property "description" must be of type string.');
		} else if (!manifest.authors || (typeof manifest.name !== 'object' && !Array.isArray(manifest.authors))) {
			throw new Error('Manifest property "authors" must be of type array.');
		} else if (!manifest.version || typeof manifest.version !== 'string' || !Regex.SemanticVersioning.test(manifest.version)) {
			throw new Error('Manifest property "version" must be of type string and match the semantic versioning pattern.');
		} else if (!manifest.id || typeof manifest.id !== 'string') {
			throw new Error('Manifest property "id" must be of type string and match a "eternal.unbound" pattern.');
		}
	}

	getStates() {
		return this.settings.get('states', {});
	}

	isEnabled(id: string) {
		const states = this.getStates();
		return !!states[id];
	}

	resolve(id: Resolveable): T | void {
		if ((id as T).data) return id as T;

		const storage = this.entities.get(id as string);
		if (storage) return storage as T;

		const entities = [...this.entities.values()];
		const name = entities.find(e => e.data.name === id);
		if (name) return name as T;
	}
}

export default Addons;
