import type { ADDON_SCOPE_GLOBALS } from '../../../packages/types/typings/addons';

type AddonScopeGlobal = (typeof ADDON_SCOPE_GLOBALS)[number];

type ScopeGlobal = {
	/** The member's type in the SDK's `AddonScope`, written against the names `global.d.ts` has in scope. */
	type: string;
	/** Whether `global.d.ts` declares the global; lib declares the timers and `@unbound-app/types` declares `React`. */
	declare: boolean;
};

/**
 * Each Addon scope global (ADR-0002) in SDK terms. The client's `AddonGlobals` types members as client
 * namespaces, which dts-bundle-generator cannot bundle. Keyed by ADDON_SCOPE_GLOBALS, so a new global fails to compile until typed here.
 */
export const ADDON_SCOPE: Record<AddonScopeGlobal, ScopeGlobal> = {
	React: { type: 'typeof React', declare: false },
	unbound: { type: 'UnboundGlobal', declare: true },
	// Not `AddonHandle<Plugin>`: `_internal.d.ts` declares `Plugin` as `Plugin$1`, and the bare name is lib.dom's.
	addon: { type: 'AddonHandle', declare: true },
	patcher: { type: "UnboundGlobal['patcher']", declare: true },
	logger: { type: 'AddonLogger', declare: true },
	setTimeout: { type: 'typeof setTimeout', declare: false },
	setInterval: { type: 'typeof setInterval', declare: false },
	clearTimeout: { type: 'typeof clearTimeout', declare: false },
	clearInterval: { type: 'typeof clearInterval', declare: false },
	commands: {
		type: "Omit<ReturnType<UnboundGlobal['commands']['createCommands']>, keyof UnboundGlobal['commands']> & UnboundGlobal['commands']",
		declare: true,
	},
};
