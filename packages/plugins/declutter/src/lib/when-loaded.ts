import type { AnyProps } from '@unbound-app/api/metro';
import { metro } from '@unbound-app/api';

const waiting = new Set<() => void>();

/** Where a Declutter target's module lives: its file path, the name of its default export, or its props. */
export type ModuleSelector = { path: string } | { name: string } | { props: string[] };

function filterOf(selector: ModuleSelector) {
	if ('path' in selector) return metro.filters.byFilePath(selector.path);

	if ('name' in selector) return metro.filters.byName(selector.name);

	return metro.filters.byProps(...selector.props);
}

/**
 * @description Runs `patch` with a Discord module once it loads, now when it already has, since many of Declutter's screens load late.
 * @param selector The module to wait for.
 * @param patch Patches the loaded module.
 */
export function whenLoaded(selector: ModuleSelector, patch: (module: AnyProps) => void): void {
	waiting.add(metro.onModuleLoaded(filterOf(selector), patch, { interop: false }));
}

/**
 * @description Stops waiting for modules that have not loaded, so a later load cannot patch after the plugin stopped.
 */
export function stopWaiting(): void {
	for (const stop of waiting) stop();

	waiting.clear();
}

export default whenLoaded;
