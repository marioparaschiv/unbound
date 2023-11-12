import type { Addon, Manifest, InternalManifest, Resolveable } from '@typings/managers';
import EventEmitter from '@structures/emitter';
import { capitalize } from '@utilities';
import { getStore } from '@api/storage';
import { createLogger } from '@logger';
import { DCDFileManager } from '@api/storage';
import { Regex } from '@constants';

const { LayoutAnimation: { configureNext, Presets } } = ReactNative;

export enum ManagerType {
	Plugins = 'plugin',
	Themes = 'theme',
	Icons = 'pack'
}

class Manager extends EventEmitter {
	public logger: ReturnType<typeof createLogger>;
	public settings: ReturnType<typeof getStore>;
	public id: 'plugin' | 'theme';
	public entities = new Map();
	public started = new Set();
	public errors = new Map();
	public type: ManagerType;
	public extension: string;
	public path: string;
	public name: string;
	public icon: string;

	constructor(type: ManagerType) {
		super();

		this.type = type;
		this.name = capitalize(type) + 's';

		this.logger = createLogger('Manager', this.name);
		this.settings = getStore(`${type}-states`);

		this.path = `Unbound/${this.name}`;
	}

	async showAddonToast(addon: Addon, message: string) {
		const { i18n } = await import('@metro/common');
		const { showToast } = await import('@api/toasts');

		showToast({
			title: addon.data.name,
			content: i18n.Messages[message],
			icon: (() => {
				if (addon.data.icon && addon.data.icon !== '__custom__') return addon.data.icon;

				return this.icon ?? 'CircleQuestionIcon';
			})()
		});
	}

	async installWithToast(url: string, addon?: Addon) {
		const { showToast } = await import('@api/toasts');
		const { i18n } = await import('@metro/common');
		const controller = new AbortController();
		const title = addon ? addon.data.name : this.name;

		const toast = showToast({
			title,
			content: i18n.Messages.UNBOUND_DOWNLOAD_PACK_FETCHING,
			icon: 'ic_download_24px',
			duration: 0
		});

		toast.update({
			buttons: [{
				content: i18n.Messages.CANCEL,
				onPress: () => {
					controller.abort();
					toast.close();

					showToast({
						title,
						content: i18n.Messages.UNBOUND_INSTALL_CANCELLED.format({ type: capitalize(this.type) }),
						icon: 'CloseLargeIcon'
					});
				}
			}]
		});

		await this.install(
			url,
			({ message }) => {
				toast.update({
					content: message
				});
			},
			controller.signal
		).then((addon) => {
			if (addon instanceof Error) {
				toast.update({
					content: i18n.Messages.UNBOUND_DOWNLOAD_ADDON_FAILED.format({ error: addon.message })
				});

				return;
			}

			toast.update({
				content: i18n.Messages.UNBOUND_DOWNLOAD_ADDON_DONE.format({ type: this.type, name: `'${addon.data.name}'` })
			});
		});

		toast.close();
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
				action: async () => {
					// Avoid circular dependency
					const { i18n } = await import('@metro/common');
					const { showAlert } = await import('@api/dialogs');

					showAlert({
						title: i18n.Messages.UNBOUND_UNINSTALL_ADDON.format({ type: capitalize(this.type) }),
						content: i18n.Messages.UNBOUND_UNINSTALL_ADDON_DESC.format({ name: addon.data.name }),
						buttons: [
							{
								text: i18n.Messages.UNBOUND_UNINSTALL,
								onPress: () => this.delete(addon.id)
							}
						]
					});
				}
			}
		];
	}

	getContextItems(addon: Addon, ...args) {
		return this.getBaseContextItems(addon);
	}

	async install(url: string, setState: Fn, ...args): Promise<Error | Addon> {
		this.logger.debug(`Fetching ${url} for manifest...`);
		const manifest = await fetch(url, { cache: 'no-cache' })
			.then(res => {
				if (res.ok) return res;
				setState({ message: `${res.status}: ${res.statusText}` });
			})
			.then(res => res.json())
			.catch(e => setState({ message: e.message })) as InternalManifest;

		try {
			this.logger.debug('Validating manifest...');
			this.validateManifest(manifest as InternalManifest);

			manifest.url = url;
		} catch (e) {
			this.logger.debug('Failed to validate manifest:', e.message);
			setState({ message: e.message });
			return;
		}

		this.logger.debug(`Fetching bundle from ${manifest.bundle}...`);
		const bundle = await fetch((manifest as any).bundle, { cache: 'no-cache' })
			.then(res => {
				if (res.ok) return res;
				setState({ message: `${res.status}: ${res.statusText}` });
			})
			.then(r => r.text())
			.catch(e => setState({ message: e.message }));

		this.logger.debug('Done fetching...');

		this.logger.debug('Saving...');
		this.save(bundle as string, manifest);
		this.logger.debug('Loading...');

		const existing = this.entities.get(manifest.id);

		if (existing?.started) {
			this.logger.debug(`Unloading existing instance of ${manifest.id}...`);
			this.unload(manifest.id);
		}

		const addon = this.load(bundle as string, manifest);
		this.logger.debug('Loaded.');

		const { Redesign } = await import('@metro/components');

		Redesign.dismissAlerts();

		await this.showAddonToast(addon, 'UNBOUND_SUCCESSFULLY_INSTALLED');
		return addon;
	}

	save(bundle: string, manifest: Manifest) {
		DCDFileManager.writeFile('documents', `${this.path}/${manifest.id}/bundle.${this.extension}`, bundle, 'utf8');
		DCDFileManager.writeFile('documents', `${this.path}/${manifest.id}/manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');
	}

	load(bundle: string, manifest: Manifest): Addon {
		const data = { failed: false, instance: null };

		try {
			this.validateManifest(manifest);

			const res = this.handleBundle(bundle);
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

	async delete(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			this.unload(addon);
			await DCDFileManager.deleteFile('documents', `${this.path}/${addon.data.id}`);
			await this.showAddonToast(addon, 'UNBOUND_SUCCESSFULLY_UNINSTALLED');
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

		this.emit('toggle');
	}

	enable(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			this.settings.set(addon.id, true);

			if (!addon.started) {
				this.start(addon);
			}
		} catch (e) {
			this.logger.error(`Failed to enable ${addon.data.id}:`, e.message ?? e);
		}
	}

	disable(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			this.settings.set(addon.id, false);

			if (addon.started) {
				this.stop(addon);
			}
		} catch (e) {
			this.logger.error(`Failed to stop ${addon.data.id}:`, e.message ?? e);
		}
	}

	isEnabled(id: string): boolean {
		return this.errors.has(id) ? false : this.settings.get(id, false);
	}

	unload(entity: Resolveable) {
		const addon = this.resolve(entity);
		if (!addon) return;

		try {
			if (addon.started) {
				this.stop(addon);
			}

			this.entities.delete(addon.id);
			this.emit('updated');
		} catch (e) {
			this.logger.error(`FATAL: ${addon.id} was not able to unload properly, a full app restart is recommended.`, e);
		}
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

	handleBundle(bundle: string) {
		return '';
	}

	handleInvalidBundle() {
		throw new Error('Bundle didn\'t return an instance.');
	}

	resolve(id: Resolveable): Addon | void {
		if ((id as Addon).data) return id as Addon;

		const storage = this.entities.get(id);
		if (storage) return storage as Addon;

		const entities = [...this.entities.values()];
		const name = entities.find(e => e.data.name === id);
		if (name) return name as Addon;
	}

	useEntities() {
		const [, forceUpdate] = React.useState({});

		React.useEffect(() => {
			function handler() {
				configureNext(Presets.spring);
				forceUpdate({});
			}

			this.on('updated', handler);
			this.on('toggle', handler);

			return () => {
				this.off('updated', handler);
				this.off('toggle', handler);
			};
		}, []);

		return this.addons;
	}

	get addons() {
		return [...this.entities.values()];
	}
}

export default Manager;