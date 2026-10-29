import type {
	ComponentRecord,
	ConstantValue,
	ImportRef,
	LiteralValue,
	ModuleFacts,
	PropObservation,
} from './types';
import type { Value } from './values';

/** Resolves an imported value to the literal it holds, or undefined when it is not a known constant. */
export type ConstantLookup = (ref: ImportRef) => LiteralValue | undefined;

const MAX_DEPTH = 4;
const MAX_HOPS = 16;

/**
 * @description Reads a walked value as a constant: a literal, or an object whose entries are constants.
 * @param value The value bound to an export.
 * @param depth How many objects deep the value sits.
 * @returns The constant, or undefined when the value is not one.
 */
export function constantOf(value: Value, depth: number = 0): ConstantValue | undefined {
	if (value.kind === 'literal') {
		return value.value;
	}

	if (value.kind !== 'object' || depth >= MAX_DEPTH) return;

	const table = new Map<string, ConstantValue>();

	for (const [key, entry] of value.object.entries) {
		const constant = constantOf(entry, depth + 1);

		if (constant !== undefined) {
			table.set(key, constant);
		}
	}

	return table.size > 0 ? table : undefined;
}

/**
 * @description Builds the lookup from imported values to literals over every extracted module's constants,
 * following re-exports and interop defaults the way component targets resolve.
 * @param facts The extracted modules.
 * @returns The lookup.
 */
export function createConstantLookup(facts: ModuleFacts[]): ConstantLookup {
	const modules = new Map(facts.map((module) => [module.moduleId, module]));
	const reExports = new Map<string, ImportRef>();

	for (const module of facts) {
		for (const { exportName, target } of module.reExports) {
			reExports.set(`${module.moduleId}:${exportName}`, target);
		}
	}

	function lookup(moduleId: number, path: string[], hops: number): LiteralValue | undefined {
		const [head, ...rest] = path;

		if (head === undefined || hops > MAX_HOPS) return;

		const module = modules.get(moduleId);
		const own = module?.constants.get(head);

		if (own !== undefined) {
			return walk(own, rest);
		}

		const reExport = reExports.get(`${moduleId}:${head}`);

		if (reExport) {
			return lookup(reExport.moduleId, [...reExport.name.split('.'), ...rest], hops + 1);
		}

		for (const source of module?.starExports ?? []) {
			const value = lookup(source, path, hops + 1);

			if (value !== undefined) {
				return value;
			}
		}

		// An interop default of a CommonJS module is the module itself.
		return head === 'default' ? lookup(moduleId, rest, hops + 1) : undefined;
	}

	return (ref) => lookup(ref.moduleId, ref.name.split('.'), 0);
}

function walk(value: ConstantValue, path: string[]): LiteralValue | undefined {
	let at: ConstantValue | undefined = value;

	for (const key of path) {
		at = at instanceof Map ? at.get(key) : undefined;
	}

	return at instanceof Map ? undefined : at;
}

/**
 * @description Replaces each prop's references to imported constants with the literal they hold, so the rules
 * see `variant === ButtonVariants.PRIMARY` as a comparison with `'primary'`. Unresolved comparisons are dropped
 * and unresolved defaults stay plain expressions, as before references were recorded.
 * @param components The extracted components.
 * @param lookup The constant lookup.
 */
export function resolveConstantRefs(components: ComponentRecord[], lookup: ConstantLookup) {
	for (const component of components) {
		for (const [name, evidence] of component.props) {
			const resolved = evidence.flatMap((observation) =>
				resolveObservation(observation, lookup),
			);

			if (resolved.length > 0) {
				component.props.set(name, resolved);
			} else {
				component.props.delete(name);
			}
		}
	}
}

function resolveObservation(
	observation: PropObservation,
	lookup: ConstantLookup,
): PropObservation[] {
	if (observation.kind === 'default-ref') {
		const value = lookup(observation.ref);

		return [value === undefined ? { kind: 'default-expression' } : { kind: 'default', value }];
	}

	if (observation.kind !== 'compared-ref') {
		return [observation];
	}

	const value = lookup(observation.ref);

	if (value === undefined) {
		return [];
	}

	return [value === null ? { kind: 'guarded' } : { kind: 'compared', value }];
}

export default { constantOf, createConstantLookup, resolveConstantRefs };
