import { Addon, Manifest, Resolveable } from '@typings/managers';
import Manager, { ManagerType } from './base';
import { createPatcher } from '@patcher';

const Patcher = createPatcher('Themer');

class Themes extends Manager {
  public original: Record<any, any>;

  constructor() {
    super(ManagerType.Themes);
  }

  override start(addon: Resolveable) {
    const entity = this.resolve(addon);
    if (!entity) return;

    // Object.assign(Constants.ThemeColorMap, entity.instance.main);
    // Object.assign(Constants.Colors, entity.instance.native);
    // Object.assign(Constants.UNSAFE_Colors, entity.instance.misc);

    this.emit('applied', entity);
    this.logger.log(`${entity.id} started.`);
  }

  initialize(mdl) {

  }

  override handleBundle(bundle: string) {
    return JSON.parse(bundle);
  }
}

export default new Themes();