import Manager, { ManagerType } from './base';

class Plugins extends Manager {
  constructor() {
    super(ManagerType.Plugins);

    this.initialize();
  }

  initialize() {
    for (const plugin of window.ENMITY_PLUGINS) {
      const { manifest, bundle } = plugin;

      this.load(bundle, manifest);
    }
  }
}

export default new Plugins();