import type { Addon, Manifest, Resolveable } from '@typings/managers';
import { createLogger } from '@structures/logger';
import EventEmitter from '@structures/emitter';
import { useEffect, useState } from 'react';
import { capitalize } from '@utilities';
import { getStore } from '@api/storage';
import { REGEX } from '@constants';
import fs from '@api/fs';

export enum ManagerKind {
	PLUGINS,
	THEMES,
	ICONS,
	SOURCES
}

export const ManagerName = {
	[ManagerKind.PLUGINS]: 'Plugins',
	[ManagerKind.THEMES]: 'Themes',
	[ManagerKind.ICONS]: 'Icons',
	[ManagerKind.SOURCES]: 'Sources'
};

export enum ManagerEntity {
	PLUGINS = 'plugin',
	THEMES = 'theme',
	ICONS = 'pack',
	SOURCES = 'source'
}

class Manager extends EventEmitter {
	public logger: ReturnType<typeof createLogger>;
	public settings: ReturnType<typeof getStore>;
	public extension: string;
	public path: string;
	public name: string;
	public icon: string;
	public id: Manager;

	public entities = new Map<string, Addon>();
	public initialized: boolean = false;
	public started = new Set();
	public errors = new Map();

	constructor(
		public type: ManagerKind
	) {
		super();

		this.name = ManagerName[type];
		this.logger = createLogger('Manager', this.name);
		this.settings = getStore(this.name.toLowerCase());

		this.path = `Unbound/${this.name}`;
	}

	async showAddonToast(addon: Addon | null, message: string, icon?: string) {
		// const { Strings } = await import('@api/i18n');
		// const { showToast } = await import('@api/toasts');
		// const { Icons } = await import('@api/assets');

		// showToast({
		// 	title: addon?.data?.name ?? this.name,
		// 	content: Strings[message],
		// 	icon: (() => {
		// 		if (icon) return Icons[icon];
		// 		if (addon?.data?.icon) {
		// 			return typeof addon.data.icon === 'string' ? Icons[addon.data.icon] : addon.data.icon;
		// 		}

		// 		return this.icon ?? 'CircleQuestionIcon';
		// 	})(),
		// 	tintedIcon: true
		// });
	}

	async installWithToast(url: string, addon?: Addon) {
		// const { showToast } = await import('@api/toasts');
		// const { Strings } = await import('@api/i18n');
		// const controller = new AbortController();
		// const title = addon ? addon.data.name : this.name;

		// const toast = showToast({
		// 	title,
		// 	content: Strings.UNBOUND_DOWNLOAD_PACK_FETCHING,
		// 	icon: 'ic_download_24px',
		// 	duration: 0
		// });

		// toast.update({
		// 	buttons: [{
		// 		content: Strings.CANCEL,
		// 		onPress: () => {
		// 			controller.abort();
		// 			toast.close();

		// 			showToast({
		// 				title,
		// 				content: Strings.UNBOUND_INSTALL_CANCELLED.format({ type: capitalize(this.type.toString()) }),
		// 				icon: 'CloseLargeIcon'
		// 			});
		// 		}
		// 	}]
		// });

		// await this.install(
		// 	url,
		// 	({ message, error }) => {
		// 		toast.update({
		// 			content: message ?? error
		// 		});
		// 	},
		// 	controller.signal
		// ).then((addon) => {
		// 	if (addon instanceof Error) {
		// 		toast.update({
		// 			content: Strings.UNBOUND_DOWNLOAD_ADDON_FAILED.format({ error: addon.message })
		// 		});

		// 		return;
		// 	}

		// 	toast.update({
		// 		content: Strings.UNBOUND_DOWNLOAD_ADDON_DONE.format({ type: this.type, name: `'${addon.data.name}'` })
		// 	});
		// });

		// toast.close();
	}

	getBaseContextItems(addon: Addon) {
		return [
			{
				label: 'UNBOUND_REFETCH',
				icon: 'ic_message_retry',
				action: async () => {
					this.installWithToast(addon.data.url, addon);
				}
			},
			{
				label: 'UNBOUND_UNINSTALL',
				icon: 'trash',
				variant: 'destructive',
				action: async () => {
					// Avoid circular dependency
					const { showDialog } = await import('@api/dialogs');
					const { Strings } = await import('@api/i18n');

					showDialog({
						title: Strings.UNBOUND_UNINSTALL_ADDON.format({ type: capitalize(this.type.toString()) }),
						content: Strings.UNBOUND_UNINSTALL_ADDON_DESC.format({ name: addon.data.name }),
						buttons: [
							{
								text: Strings.UNBOUND_UNINSTALL,
								onPress: () => this.delete(addon.id)
							}
						]
					});
				}
			}
		];
	}

	getContextItems(addon: Addon) {
		return this.getBaseContextItems(addon);
	}

	async onFinishedInstalling(addon: Addon, manifest) {
		const { Design } = await import('@api/metro/components');

		Design.dismissAlerts();

		await this.showAddonToast(addon, 'UNBOUND_SUCCESSFULLY_INSTALLED');
		return addon;
	}

	async fetchBundle(url: string, manifest: Manifest, signal: AbortSignal, setState?: Fn) {
		const origin = url.split('/');

		// Remove manifest.json at the end of the URL
		origin.pop();

		const main = origin.join('/') + '/' + manifest.main;

		this.logger.debug(`Fetching bundle from ${main}...`);

		const request = await fetch(main, { cache: 'no-cache', signal }).catch((error) => {
			setState({ error: error.message });
			return null;
		});

		if (!request) return;

		if (!request.ok) {
			this.logger.debug(`Failed to fetch: ${request.status}: ${request.statusText}`);
			return setState({ error: `${request.status}: ${request.statusText}` });
		}

		const bundle = await request.text();
		if (!bundle) return;

		this.logger.debug(`Successfully fetched ${main}.`);

		return bundle;
	}

	save(bundle: string, manifest: Manifest) {
		fs.write(`${this.path}/${manifest.id}/bundle.${this.extension}`, bundle);
		fs.write(`${this.path}/${manifest.id}/manifest.json`, JSON.stringify(manifest, null, 2));
	}

	load(bundle: string, manifest: Manifest): Addon {
		const data = { failed: false, instance: null };

		try {
			this.validateManifest(manifest);

			const res = this.handleBundle(bundle, manifest);
			if (!res) this.handleInvalidBundle();

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
		} satisfies Addon;

		this.entities.set(manifest.id, addon);

		if (this.isEnabled(addon.id)) {
			this.start(addon);
		}

		this.emit('updated');

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

			this.emit('updated');
		} catch (e) {
			this.logger.error(`FATAL: ${addon.id} was not able to unload properly, a full app restart is recommended.`, e);
		}
	}

	async install(url: string, setState?: Fn, signal?: AbortSignal, ...args): Promise<Error | Addon> {
		this.logger.debug(`Fetching ${url} for manifest...`);

		const request = await fetch(url, { cache: 'no-cache' }).catch((error) => {
			setState({ error: error.message });
			return null;
		});

		if (!request) return;

		if (!request.ok) {
			return setState?.({ error: `Failed to install (${request.status}: ${request.statusText})` });
		}

		const manifest = await request.json();

		try {
			this.logger.debug('Validating manifest...');
			this.validateManifest(manifest as Manifest);

			manifest.url = url;
		} catch (e) {
			this.logger.debug('Failed to validate manifest:', e.message);
			setState?.({ error: e.message });
			return;
		}

		const bundle = await this.fetchBundle(url, manifest, signal, setState);

		this.logger.debug('Saving...');
		this.save(bundle as string, manifest);
		this.logger.debug('Loading...');

		const existing = this.entities.get(manifest.id);

		if (existing) {
			this.logger.debug(`Unloading existing instance of ${manifest.id}...`);
			this.unload(manifest.id);
		}

		const addon = this.load(bundle as string, manifest);
		this.logger.debug('Loaded.');

		return this.onFinishedInstalling(addon, manifest);
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
			if (!addon.started) {
				this.start(addon);
			}

			this.settings.set(addon.id, true);
			this.emit('enabled', addon);
		} catch (e) {
			this.logger.error(`Failed to enable ${addon.data.id}:`, e.message ?? e);
		}
	}

	disable(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			if (addon.started) {
				this.stop(addon);
			}

			this.settings.set(addon.id, false);
			this.emit('disabled', addon);
		} catch (e) {
			this.logger.error(`Failed to stop ${addon.data.id}:`, e.message ?? e);
		}
	}

	isEnabled(id: string): boolean {
		return this.errors.has(id) ? false : this.settings.get(id, false);
	}

	shutdown() {
		for (const addon of this.addons) {
			try {
				this.unload(addon);
			} catch (e) {
				this.logger.error(`Failed to stop ${addon.id}. Skipping.`, e.message ?? e);
				continue;
			}
		}

		this.initialized = false;
	}

	validateManifest(manifest: Manifest) {
		if (!manifest.name || typeof manifest.name !== 'string') {
			throw new Error('Manifest property "name" must be of type string.');
		} else if (!manifest.description || typeof manifest.description !== 'string') {
			throw new Error('Manifest property "description" must be of type string.');
		} else if (!manifest.authors || (typeof manifest.name !== 'object' && !Array.isArray(manifest.authors))) {
			throw new Error('Manifest property "authors" must be of type array.');
		} else if (!manifest.version || typeof manifest.version !== 'string' || !REGEX.SemanticVersioning.test(manifest.version)) {
			throw new Error('Manifest property "version" must be of type string and match the semantic versioning pattern.');
		} else if (!manifest.id || typeof manifest.id !== 'string') {
			throw new Error('Manifest property "id" must be of type string and match a "eternal.unbound" pattern.');
		}
	}

	handleBundle(bundle: string, manifest: Manifest) {
		return '';
	}

	handleInvalidBundle() {
		throw new Error('Bundle didn\'t return an instance.');
	}

	resolve(id: Resolveable): Addon | void {
		if ((id as Addon).data) return id as Addon;

		const storage = this.entities.get(id as string);
		if (storage) return storage as Addon;

		const entities = [...this.entities.values()];
		const name = entities.find(e => e.data.name === id);
		if (name) return name as Addon;
	}

	useEntities() {
		const [, forceUpdate] = useState({});

		useEffect(() => {
			function handler() {
				forceUpdate({});
			}

			this.on('updated', handler);
			this.on('enabled', handler);
			this.on('disabled', handler);

			return () => {
				this.off('updated', handler);
				this.off('enabled', handler);
				this.off('disabled', handler);
			};
		}, []);

		return this.addons;
	}

	get addons() {
		return [...this.entities.values()];
	}

	static isValidManager(type: ManagerKind) {
		return Object.values(ManagerKind).includes(type);
	}

	static isValidManagerEntity(type: ManagerEntity) {
		return Object.values(ManagerEntity).includes(type);
	}
}

export default Manager;