import { Dispatcher } from '@metro/common';
import { Theme as ThemeStore } from '@metro/stores';
import { Themes } from '@metro/ui';

export function initialize() {
  if (!Dispatcher?.subscribe) return;

  Dispatcher.subscribe('CONNECTION_OPEN', handler);
}

function handler() {
  Themes.overrideTheme(ThemeStore.theme);
}

export default { initialize };