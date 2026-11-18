import type { Plugin } from './rule';

import platformCheckOnlyInPlatformFile from './platform-check-only-in-platform-file.ts';
import workletDeclarationOrder from './worklet-declaration-order.ts';
import noModuleScopeLookup from './no-module-scope-lookup.ts';
import noWindowUnbound from './no-window-unbound.ts';

const addonRules: Plugin = {
	meta: { name: 'unbound' },
	rules: {
		'platform-check-only-in-platform-file': platformCheckOnlyInPlatformFile,
		'no-module-scope-lookup': noModuleScopeLookup,
		'no-window-unbound': noWindowUnbound,
		'worklet-declaration-order': workletDeclarationOrder,
	},
};

export default addonRules;
