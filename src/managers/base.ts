import type { Addon, Manifest, Resolveable } from '@typings/managers';
import EventEmitter from '@structures/emitter';
import { capitalize } from '@utilities';
import { getStore } from '@api/storage';
import { createLogger } from '@logger';
import { Regex } from '@constants';

const { DCDFileManager } = ReactNative.NativeModules;

export enum ManagerType {
  Plugins = 'plugin',
  Themes = 'theme'
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

  constructor(type: ManagerType) {
    super();

    this.type = type;
    this.name = capitalize(type) + 's';

    this.logger = createLogger('Manager', this.name);
    this.settings = getStore(`${type}-states`);

    this.path = `Enmity/${this.name}`;
  }

  async install(url: string): Promise<Error | void> {
    this.logger.debug(`Fetching ${url} for manifest...`);
    const manifest = await fetch(url, { cache: 'no-cache' }).then(r => r.json()) as Manifest;

    try {
      this.logger.debug('Validating manifest...');
      this.validateManifest(manifest as Manifest);
    } catch (e) {
      return this.logger.debug('Failed to validate manifest:', e.message);
    }

    this.logger.debug(`Fetching bundle from ${(manifest as any).bundle}...`);
    const bundle = await fetch((manifest as any).bundle, { cache: 'no-cache' }).then(r => r.text());
    this.logger.debug('Done fetching...');

    this.logger.debug('Saving...');
    this.save(bundle, manifest);
    this.logger.debug('Loading...');
    this.load(bundle, manifest);
  }

  save(bundle: string, manifest: Manifest) {
    DCDFileManager.writeFile('documents', `${this.path}/${manifest.name}/bundle.${this.extension}`, bundle, 'utf8');
    DCDFileManager.writeFile('documents', `${this.path}/${manifest.name}/manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');
  }

  load(bundle: string, manifest: Manifest) {
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
    } as Addon;

    this.entities.set(manifest.id, addon);

    if (this.isEnabled(addon.id)) {
      this.start(addon);
    }

    this.emit('updated');
  }

  delete(entity: Resolveable) {
    const addon = this.resolve(entity);
    if (!addon) return;

    try {
      this.unload(addon);
      DCDFileManager.writeFile('documents', `${this.path}/${addon.data.name}/.delete`, '', 'utf8');
    } catch (e) {
      this.logger.error(`Failed to delete ${addon.data.id}:`, e.message);
    }
  }

  start(entity: Resolveable) {
    const addon = this.resolve(entity);
    if (!addon) return;

    try {
      addon.instance.start?.();
      addon.started = true;
    } catch (e) {
      this.logger.error(`Failed to start ${addon.data.id}:`, e.message);
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
      this.logger.error(`Failed to stop ${addon.data.id}:`, e.message);
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
      this.logger.error(`Failed to enable ${addon.data.id}:`, e.message);
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
      this.logger.error(`Failed to stop ${addon.data.id}:`, e.message);
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
        this.logger.error(`Failed to stop ${addon.id}. Skipping.`, e.message);
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
      throw new Error('Manifest property "id" must be of type string and match a "eternal.enmity" pattern.');
    }
  }

  handleBundle(bundle: string) {
    return '';
  }

  handleInvalidBundle() {
    throw new Error('Bundle didn\'t return an instance.');
  }

  resolve(id: any): Addon | void {
    if (id.data) return id;

    const storage = this.entities.get(id);
    if (storage) return storage;

    const entities = [...this.entities.values()];
    const name = entities.find(e => e.data.name === id);
    if (name) return name;
  }

  useEntities() {
    const [, forceUpdate] = React.useState({});

    React.useEffect(() => {
      function handler() {
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