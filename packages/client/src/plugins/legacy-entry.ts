import type { Plugin, PluginContext, PluginSelfTestResult } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';
import type { ReactNode } from 'react';

/** The `export default { start, stop, getSettingsPanel }` object a bundle built before named exports holds. */
// An older ubd's IIFE returned that object itself when it was the only export, and `{ default }` otherwise.
type LegacyPlugin = {
	start?(context?: PluginContext): void | Promise<void>;
	stop?(): void | Promise<void>;
	getSettingsPanel?(): ReactNode;
	selfTest?(): PluginSelfTestResult | Promise<PluginSelfTestResult>;
};

const Logger = createLogger('Plugins', 'Entry');
const noted = new Set<string>();

type LegacyModule = { default: LegacyPlugin };

// UNKNOWN: a bundle's module is whatever its entry exported.
function isModule(module: unknown): module is Plugin {
	return (typeof module === 'object' || typeof module === 'function') && module !== null;
}

// UNKNOWN: a bundle's module is whatever its entry exported.
function isLegacy(module: unknown): module is LegacyModule {
	return (
		isModule(module) &&
		!('start' in module) &&
		!('stop' in module) &&
		'default' in module &&
		typeof module.default === 'object' &&
		module.default !== null
	);
}

// UNKNOWN: a bundle's module is whatever its entry exported.
function isFlatLegacy(module: unknown): module is LegacyPlugin {
	return (
		isModule(module) &&
		!('SettingsPanel' in module) &&
		'getSettingsPanel' in module &&
		typeof module.getSettingsPanel === 'function'
	);
}

// UNKNOWN: a bundle's module is whatever its entry exported; this narrows it.
function legacyOf(module: unknown): LegacyPlugin | undefined {
	if (isLegacy(module)) {
		return module.default;
	}

	return isFlatLegacy(module) ? module : undefined;
}

function adapt(legacy: LegacyPlugin): Plugin {
	// Each method runs on the default object, so `this` inside it still reaches its siblings.
	return {
		start: legacy.start?.bind(legacy),
		stop: legacy.stop?.bind(legacy),
		selfTest: legacy.selfTest?.bind(legacy),
		SettingsPanel: legacy.getSettingsPanel && (() => legacy.getSettingsPanel?.() ?? null),
	};
}

/**
 * @description Reads a plugin bundle's entry module as its named exports. A bundle built before named exports
 * holds `export default { start, stop, getSettingsPanel }`; it still runs, its `getSettingsPanel` served as
 * `SettingsPanel`, with one dev-only note per plugin to rebuild it.
 * @param id The plugin's id, named in the note.
 * @param module What the bundle's entry evaluated to.
 * @returns The entry's `start`, `stop`, `selfTest` and `SettingsPanel`.
 */
// UNKNOWN: a bundle's module is whatever its entry exported; this narrows it.
export function readPluginEntry(id: string, module: unknown): Plugin {
	const legacy = legacyOf(module);

	if (!legacy) {
		return isModule(module) ? module : {};
	}

	if (import.meta.env.DEV_TOOLS && !noted.has(id)) {
		noted.add(id);
		Logger.warn(
			`Plugin ${id} was built with a default-export entry; rebuild it with the current ubd to use named exports.`,
		);
	}

	return adapt(legacy);
}

export default readPluginEntry;
