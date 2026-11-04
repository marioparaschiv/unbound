import { metro as pluginMetro } from '@unbound-app/api';
import { metro } from '@unbound-app/api/testing';

type Module = Record<string, unknown>;

const registered: Module[] = [];

// The fake metro's `find` ignores `all`, which the share actions lookup passes; this answers it from what the test registered.
const find = pluginMetro.find.bind(pluginMetro);

Object.assign(pluginMetro, {
	find(filter: (module: Module) => boolean, options?: { all?: boolean }) {
		return options?.all ? registered.filter((module) => filter(module)) : find(filter as never);
	},
});

/** Registers a Discord module the plugin finds, and keeps it for lookups that want every match. */
export function register<T extends Module>(module: T): T {
	registered.push(module);
	metro.register(module);

	return module;
}
