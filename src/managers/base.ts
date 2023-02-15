import type { Addon, Manifest, Resolveable } from '@typings/managers';
import { EventEmitter } from '@metro/common';
import { capitalize } from '@utilities';
import { getStore } from '@api/storage';
import { createLogger } from '@logger';

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
  public name: string;

  constructor(type: ManagerType) {
    super();

    this.type = type;
    this.name = capitalize(type) + 's';

    this.logger = createLogger('Manager', this.name);
    this.settings = getStore(`${type}-states`);

    this.setMaxListeners(Infinity);
  }

  async install(url: string): Promise<Error | void> {
    this.logger.debug(`Fetching ${url} for manifest...`);
    const manifest = await fetch(url, { cache: 'no-cache' }).then(r => r.json()) as Manifest;

    this.logger.debug(`Fetching bundle from ${manifest.bundle}...`);
    const bundle = await fetch(manifest.bundle, { cache: 'no-cache' }).then(r => r.text());

    this.logger.debug('Done fetching...');

    this.load(bundle, manifest);
  }

  initialize() {
    const status = { failed: 0 };

    const { ENMITY_PLUGINS } = globalThis;
    if (!ENMITY_PLUGINS) return;

    // const contents = ;


    // const entities = contents.filter(e => {
    //   try {
    //     const item = resolve(this.folder, e);
    //     return fs.statSync(item).isDirectory();
    //   } catch {
    //     return false;
    //   }
    // });

    // for (const id of ENMITY_PLUGINS) {
    //   try {
    //     const entity = this.load(id);
    //     if (entity?.failed) status.failed++;
    //   } catch (e) {
    //     status.failed++;
    //     this.logger.error(e);
    //   }
    // }
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