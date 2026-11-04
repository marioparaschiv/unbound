import enUS from '@i18n/en-US.json';

import type { LooseMessageVars } from '~/i18n/message';

const strings: Record<string, string> = enUS;

/**
 * @description Stands in for `~/i18n/api`, whose real module reads Discord's globals on import: each key reads
 * its en-US string, and `format` appends its vars so a test can see them.
 * @returns The `messages` and `format` the module exports.
 */
export function coreI18nMock() {
	return {
		messages: new Proxy({}, { get: (_target, key: string) => strings[key] ?? key }),
		format: (key: string, vars?: LooseMessageVars) =>
			vars ? `${strings[key] ?? key} ${JSON.stringify(vars)}` : (strings[key] ?? key),
	};
}

export default { coreI18nMock };
