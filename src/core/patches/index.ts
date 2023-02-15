import { createLogger } from '@logger';
import * as Patches from './registry';

const Logger = createLogger('Core', 'Patches');

export function apply() {
  for (const id in Patches) {
    const Patch = Patches[id];

    try {
      Patch.apply?.();
    } catch (e) {
      Logger.error(`Failed to apply ${id} patch:`, e.message);
    }
  }
}

export function remove() {
  for (const id in Patches) {
    const Patch = Patches[id];

    try {
      Patch.remove?.();
    } catch (e) {
      Logger.error(`Failed to remove ${id} patch:`, e.message);
    }
  }
}

export default { apply, remove };