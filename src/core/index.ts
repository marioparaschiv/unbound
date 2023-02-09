import { createLogger } from '@logger';

import WebSocket from '@builtins/websocket';
import ThemeFix from '@builtins/theme-fix';
import Settings from '@builtins/settings';
import Console from '@builtins/console';

import * as API from '@api';

const Logger = createLogger('Enmity', 'Core');

export async function initialize() {
  try {
    Console.initialize();
  } catch (e) {
    Logger.error('Console polyfill failed to initialize:', e.message);
  }

  try {
    WebSocket.initialize();
  } catch (e) {
    Logger.error('Developer WebSocket failed to initialize:', e.message);
  }

  try {
    Settings.initialize();
  } catch (e) {
    Logger.error('Settings UI failed to initialize:', e.message);
  }

  try {
    ThemeFix.initialize();
  } catch (e) {
    Logger.error('Theme fix failed to initialize:', e.message);
  }

  window.enmity = API;

  return API;
}

export async function shutdown() {
  API.patcher.unpatchAll();

  for (const type in API.managers) {
    const manager = API.managers[type];
    await manager.shutdown();
  }

  try {
    Console.shutdown();
  } catch (e) {
    Logger.error('Console polyfill failed to initialize:', e.message);
  }

  try {
    WebSocket.shutdown();
  } catch (e) {
    Logger.error('Developer WebSocket failed to shutdown:', e.message);
  }

  try {
    Settings.shutdown();
  } catch (e) {
    Logger.error('Settings UI failed to shutdown:', e.message);
  }

  // try {
  //   ThemeFix.shutdown();
  // } catch (e) {
  //   Logger.error('Theme fix failed to shutdown:', e.message);
  // }

  // API.components.forceUpdateApp();

  delete window.enmity;
}

export default { initialize, shutdown };