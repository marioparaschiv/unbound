import BuiltIns from '@core/builtins';
import Patches from '@core/patches';
import * as API from '@api';

export async function initialize() {
  Patches.apply();
  BuiltIns.initialize();

  window.enmity = API;

  return API;
}

export async function shutdown() {
  const { patcher } = API;

  patcher.unpatchAll();

  for (const type in API.managers) {
    const manager = API.managers[type];
    await manager.shutdown();
  }

  Patches.remove();
  BuiltIns.shutdown();

  delete window.enmity;
}

export default { initialize, shutdown };