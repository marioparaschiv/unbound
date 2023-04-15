import '@api/components';

import { createLogger } from '@logger';
import BuiltIns from '@core/builtins';
import Patches from '@core/patches';

import * as Commands from './commands';
import * as API from '@api';

const Logger = createLogger('Core');


export async function initialize() {
  try {
    Patches.apply();
  } catch (e) {
    Logger.error('Failed to apply patches:', e.message);
  }

  try {
    BuiltIns.initialize();
  } catch (e) {
    Logger.error('Failed to apply built-ins:', e.message);
  }

  try {
    const { commands } = API;

    commands.registerCommands('enmity', Commands);
  } catch (e) {
    Logger.error('Failed to register built-in commands:', e.message);
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