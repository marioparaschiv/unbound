import Manager, { ManagerType } from './base';
import Storage from '@api/storage';

class Plugins extends Manager {
  public extension: string = 'js';

  constructor() {
    super(ManagerType.Plugins);

    this.initialize();
  }

  initialize() {
    for (const plugin of window.ENMITY_PLUGINS ?? []) {
      const { manifest, bundle } = plugin;

      this.load(bundle, manifest);
    }
  }

  handleBundle(bundle: string) {
    if (Storage.get('enmity', 'recovery', false)) {
      return {
        start: () => { },
        stop: () => { }
      };
    }

    const iife = eval(`() => { return ${bundle} }`);
    const payload = iife();
    const res = typeof payload === 'function' ? payload() : payload;

    return res.default ?? res;
  }
}

export default new Plugins();