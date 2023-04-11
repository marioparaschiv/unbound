import type { Addon, Manifest, Resolveable } from '@typings/managers';
import EventEmitter from '@structures/emitter';
import { ReactNative } from '@metro/common';
import { capitalize } from '@utilities';
import { getStore } from '@api/storage';
import { createLogger } from '@logger';

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
  public type: ManagerType;
  public path: string;
  public name: string;

  constructor(type: ManagerType) {
    super();

    this.type = type;
    this.name = capitalize(type) + 's';

    this.logger = createLogger('Manager', this.name);
    this.settings = getStore(`${type}-states`);

    this.path = ReactNative.Platform.select({
      ios: 'Documents/Enmity/Plugins',
      default: 'Enmity/Plugins'
    });
  }

  async install(url: string): Promise<Error | void> {
    this.logger.debug(`Fetching ${url} for manifest...`);
    const manifest = await fetch(url, { cache: 'no-cache' }).then(r => r.json()) as Manifest;

    this.logger.debug(`Fetching bundle from ${(manifest as any).bundle}...`);
    const bundle = await fetch((manifest as any).bundle, { cache: 'no-cache' }).then(r => r.text());

    this.logger.debug('Done fetching...');

    this.logger.debug('Saving...');
    this.save(bundle, manifest);
    this.logger.debug('Loading...');
    this.load(bundle, manifest);
  }

  save(bundle: string, manifest: Manifest) {
    DCDFileManager.writeFile('documents', `${this.path}/${manifest.name}/bundle.js`, bundle, 'utf8');
    DCDFileManager.writeFile('documents', `${this.path}/${manifest.name}/manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');
  }

  load(bundle: string, manifest: Manifest) {
    const data = { failed: false, instance: null };

    try {
      const res = this.handleBundle(bundle);
      if (!res) this.handleInvalidBundle();

      data.instance = res;
    } catch (e) {
      this.logger.error(`Failed to execute ${manifest.id}:`, e.message);
      data.failed = true;
    }

    const addon = {
      data: manifest,
      instance: data.instance,
      started: false
    } as Addon;

    this.entities.set(manifest.id, addon);

    if (this.settings.get(manifest.id, false)) {
      this.start(addon);
    }
  }

  start(addon: Resolveable) {
    const entity = this.resolve(addon);
    if (!entity) return;

    try {
      entity.instance.start?.();
      entity.started = true;
    } catch (e) {
      this.logger.error(`Failed to start ${entity.data.id}:`, e.message);
      entity.started = false;
    }
  }

  stop(addon: Resolveable) {
    const entity = this.resolve(addon);
    if (!entity) return;

    try {
      entity.instance.stop?.();
      entity.started = false;
    } catch (e) {
      this.logger.error(`Failed to stop ${entity.data.id}:`, e.message);
      entity.started = true;
    }
  }

  enable(addon: Resolveable) {
    const entity = this.resolve(addon);
    if (!entity) return;

    try {
      this.settings.set(entity.id, true);

      if (!entity.started) {
        this.start(entity);
      }
    } catch (e) {
      this.logger.error(`Failed to enable ${entity.data.id}:`, e.message);
    }
  }

  disable(addon: Resolveable) {
    const entity = this.resolve(addon);
    if (!entity) return;

    try {
      this.settings.set(entity.id, false);

      if (entity.started) {
        this.stop(entity);
      }
    } catch (e) {
      this.logger.error(`Failed to stop ${entity.data.id}:`, e.message);
    }
  }

  isEnabled(id: string): boolean {
    return this.settings.get(id, false);
  }

  unload(addon: Resolveable) {
    const entity = this.resolve(addon);
    if (!entity) return;

    try {
      this.stop(entity);

      this.entities.delete(entity.id);
      this.emit('updated');
    } catch (e) {
      this.logger.error(`FATAL: ${entity.id} was not able to unload properly, a full app restart is recommended.`, e);
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

  handleBundle(bundle: string) {
    return eval(bundle);
  }

  handleInvalidBundle() {
    throw new Error('Bundle didn\'t return an instance.');
  }

  resolve(id: any): Addon | void {
    if (id.instance) return id;

    const storage = this.entities.get(id);
    if (storage) return storage;

    const entities = [...this.entities.values()];
    const name = entities.find(e => e.data.name === id);
    if (name) return name;
  }

  get addons() {
    return [...this.entities.values()];
  }
}

export default Manager;