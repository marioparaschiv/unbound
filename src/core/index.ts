import BuiltIns from '@core/builtins';
import Patches from '@core/patches';
import * as API from '@api';

import '@api/components';

export async function initialize() {
  try {
    Patches.apply();
  } catch (e) {
    alert('Failed to apply patches: ' + e.message);
  }

  try {
    BuiltIns.initialize();
  } catch (e) {
    alert('Failed to apply builtins: ' + e.message);
  }

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