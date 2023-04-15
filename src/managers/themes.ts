import { Resolveable } from '@typings/managers';
import Manager, { ManagerType } from './base';
import Storage from '@api/storage';

class Themes extends Manager {
  public original: Record<any, any>;
  public extension: string = 'json';
  public module: any;

  constructor() {
    super(ManagerType.Themes);
  }

  initialize(mdl: any) {
    this.module = mdl;

    for (const theme of window.ENMITY_THEMES ?? []) {
      const { manifest, bundle } = theme;

      this.load(bundle, manifest);
    }
  }

  override start(entity: Resolveable) {
    const addon = this.resolve(entity);
    if (!addon || addon.failed || !this.isEnabled(addon.id) || Storage.get('enmity', 'recovery', false)) return;

    try {
      if (addon.instance.raw) {
        if (!addon.instance.raw.PRIMARY_660) {
          addon.instance.raw.PRIMARY_660 = addon.instance?.semantic?.BACKGROUND_PRIMARY[0];
        }

        const entries = Object.entries(addon.instance.raw);

        for (const [key, value] of entries) {
          this.module.RawColor[key] = value;
          this.module.default.unsafe_rawColors[key] = value;
        }
      }

      if (addon.instance.semantic) {
        const orig = this.module.default.meta.resolveSemanticColor;

        this.module.default.meta.resolveSemanticColor = function (theme: string, ref: { [key: symbol]: string; }) {
          const key = ref[Object.getOwnPropertySymbols(ref)[0]];

          if (addon.instance.semantic[key]) {
            const index = { dark: 0, light: 1, amoled: 2 }[theme.toLowerCase()] || 0;
            const color = addon.instance.semantic[key][index];

            if (color) return color;
          }

          return orig.call(this, theme, ref);
        };
      }
    } catch (e) {
      this.logger.error('Failed to apply theme:', e.message);
    }

    this.emit('applied', addon);
    this.logger.log(`${addon.id} started.`);
  }

  override toggle(entity: Resolveable) {
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

  override enable(entity: Resolveable) {
    const addon = this.resolve(entity);
    if (!addon) return;

    try {
      this.settings.set('applied', addon.id);

      if (!addon.started) {
        this.start(addon);
      }
    } catch (e) {
      this.logger.error(`Failed to enable ${addon.data.id}:`, e.message);
    }
  }

  override disable(entity: Resolveable) {
    const addon = this.resolve(entity);
    if (!addon) return;

    try {
      this.settings.set('applied', null);

      if (addon.started) {
        this.stop(addon);
      }
    } catch (e) {
      this.logger.error(`Failed to stop ${addon.data.id}:`, e.message);
    }
  }

  override isEnabled(id: string) {
    return this.settings.get('applied', null) === id;
  }

  override handleBundle(bundle: string) {
    return typeof bundle === 'object' ? bundle : JSON.parse(bundle);
  }
}

export default new Themes();