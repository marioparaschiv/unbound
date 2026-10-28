import type {
	ComponentRecord,
	ExportEntry,
	ImportRef,
	ModuleFacts,
	ModuleSummary,
	TargetRef,
} from './types';

import { compare } from './naming';

/** A target after cross-module resolution: a component of this build, a React Native host component, or a hook. */
export type Resolved =
	| { kind: 'component'; component: ComponentRecord }
	| { kind: 'host'; name: string }
	| { kind: 'hook'; hook: ComponentRecord };

export type Resolver = (target: TargetRef) => Resolved | undefined;

const REACT_NATIVE_MARKERS = ['View', 'Text', 'StyleSheet', 'Platform', 'Pressable'];
const MAX_HOPS = 16;

/**
 * @description Finds the `react-native` package entry: a module without a source path exporting its core names.
 * @param summaries The light index of every module.
 * @returns The module id, or undefined when the build has none.
 */
export function findReactNative(summaries: Iterable<ModuleSummary>): number | undefined {
	for (const summary of summaries) {
		if (summary.path !== undefined) {
			continue;
		}

		const names = new Set(summary.exportNames);

		if (REACT_NATIVE_MARKERS.every((name) => names.has(name))) {
			return summary.id;
		}
	}

	return undefined;
}

/**
 * @description Builds the cross-module resolver over every extracted module.
 * @param facts The extracted modules.
 * @param reactNative The `react-native` module id.
 * @param hosts The React Native component names the emitted types can reference.
 * @returns A function resolving a target through exports, re-exports, interop defaults and statics.
 */
export function createResolver(
	facts: ModuleFacts[],
	reactNative: number | undefined,
	hosts: ReadonlySet<string>,
): Resolver {
	const byExport = new Map<string, ComponentRecord>();
	const hooksByExport = new Map<string, ComponentRecord>();
	const reExports = new Map<string, ImportRef>();

	for (const module of facts) {
		for (const component of module.components) {
			for (const name of component.exportNames) {
				byExport.set(`${module.moduleId}:${name}`, component);
			}
		}

		for (const hook of module.hooks) {
			for (const name of hook.exportNames) {
				hooksByExport.set(`${module.moduleId}:${name}`, hook);
			}
		}

		for (const { exportName, target } of module.reExports) {
			reExports.set(`${module.moduleId}:${exportName}`, target);
		}
	}

	function resolveImport(moduleId: number, name: string, hops: number): Resolved | undefined {
		const component = byExport.get(`${moduleId}:${name}`);
		const hook = hooksByExport.get(`${moduleId}:${name}`);
		const reExport = reExports.get(`${moduleId}:${name}`);

		if (hops > MAX_HOPS) return;

		// Checked first: react-native's getters re-export its internals, but consumers want the public host.
		if (moduleId === reactNative && hosts.has(name)) {
			return { kind: 'host', name };
		}

		if (component) {
			return { kind: 'component', component };
		}

		if (hook) {
			return { kind: 'hook', hook };
		}

		if (reExport) {
			return resolveImport(reExport.moduleId, reExport.name, hops + 1);
		}

		// An interop default of a CommonJS module (react-native included) is the module itself.
		if (name.startsWith('default.')) {
			return resolveImport(moduleId, name.slice('default.'.length), hops + 1);
		}

		const dot = name.lastIndexOf('.');

		if (dot === -1) return;

		const owner = resolveImport(moduleId, name.slice(0, dot), hops + 1);

		if (owner?.kind !== 'component') return;

		const member = owner.component.statics.find((item) => item.name === name.slice(dot + 1));

		return member?.target ? resolve(member.target, hops + 1) : undefined;
	}

	function resolve(target: TargetRef, hops: number = 0): Resolved | undefined {
		return target.kind === 'import'
			? resolveImport(target.moduleId, target.name, hops)
			: { kind: 'component', component: target.component };
	}

	return (target) => resolve(target);
}

/**
 * @description Lists every export of a module with a source path that resolves to an emitted component,
 * including re-exports such as `Button.native.tsx` exporting `BaseTextButton` as `Button`.
 * @param facts The extracted modules.
 * @param resolve The resolver.
 * @param emitted The emitted components.
 * @param paths Source path per module id.
 * @returns The entries, sorted by path then export name.
 */
export function listExports(
	facts: ModuleFacts[],
	resolve: Resolver,
	emitted: ReadonlySet<ComponentRecord>,
	paths: ReadonlyMap<number, string | undefined>,
): ExportEntry[] {
	const entries: ExportEntry[] = [];

	for (const module of facts) {
		const path = paths.get(module.moduleId);

		if (path === undefined) {
			continue;
		}

		for (const component of module.components) {
			if (!emitted.has(component)) {
				continue;
			}

			for (const exportName of new Set(component.exportNames)) {
				entries.push({ path, exportName, component });
			}
		}

		for (const { exportName, target } of module.reExports) {
			const resolved = resolve(target);

			if (resolved?.kind === 'component' && emitted.has(resolved.component)) {
				entries.push({ path, exportName, component: resolved.component });
			}
		}
	}

	return entries.sort((a, b) => compare(a.path, b.path) || compare(a.exportName, b.exportName));
}

export default { findReactNative, createResolver, listExports };
