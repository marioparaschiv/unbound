import { Theme as ThemeStore } from '@metro/stores';
import { Dispatcher } from '@metro/common';
import { Themes } from '@metro/ui';

export function apply() {
  if (!Dispatcher?.subscribe) return;

  Dispatcher.subscribe('CONNECTION_OPEN', handler);
}

export function remove() {
  if (!Dispatcher?.subscribe) return;

  Dispatcher.unsubscribe('CONNECTION_OPEN', handler);
}

function handler() {
  Themes.overrideTheme(ThemeStore.theme);
}