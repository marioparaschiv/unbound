import lazy from '@unbound-app/utils/lazy';

import type * as SettingsKit from '~/ui/settings-kit/api';

export * as marketplace from '~/marketplace/api';
export * as iconPacks from '~/icon-packs/api';
export * as builtins from '~/builtins/api';
export * as commands from '~/commands/api';
export * as settings from '~/settings/api';
export * as native from '~/native/native';
export * as dialogs from '~/dialogs/api';
export * as patcher from '~/patcher/api';
export * as plugins from '~/plugins/api';
export * as storage from '~/storage/api';
export * as updates from '~/updates/api';
export * as assets from '~/assets/api';
export * as themes from '~/themes/api';
export * as toasts from '~/toasts/api';
export * as shims from '~/core/shims';
export * as fonts from '~/fonts/api';
export * as flux from '~/flux/api';
export * as i18n from '~/i18n/api';
export * as sync from '~/sync/api';
export * as fs from '~/native/fs';
export * as metro from '~/metro';
export * as utils from '~/utils';

/** The settings kit, evaluated when first read, so startup never runs its modules. */
export const ui: typeof SettingsKit = lazy(() => require('~/ui/settings-kit/api'));
