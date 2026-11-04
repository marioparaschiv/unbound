import enUS from '@i18n/en-US.json';

import { createCommandLocales } from '~/commands/locales';
import type { CommandLocales } from '~/commands/locales';
import { coreMessages } from '~/i18n/core-lookup';
import { onLocaleChange } from '~/i18n/locale';

declare global {
	// Unbound's own commands take its core keys; a plugin's come from its generated `src/unbound-i18n.d.ts`.
	// oxlint-disable-next-line typescript/consistent-type-definitions -- merging needs an interface.
	interface UnboundMessageKeys extends Record<keyof typeof enUS, true> {}
}

/** Unbound's own command text, read from its core translations. */
export const coreLocales: CommandLocales = createCommandLocales(enUS, coreMessages, (listener) =>
	onLocaleChange(() => listener()),
);

export default { coreLocales };
