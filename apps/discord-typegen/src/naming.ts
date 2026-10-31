import type { ComponentRecord } from './types';

const SKIPPED_SEGMENTS = new Set(['native', 'components', 'components_native', 'index', 'shared']);

function identifier(name: string): string {
	const cleaned = name.replace(/[^\w$]/g, '_');

	return /^\d/.test(cleaned) ? `_${cleaned}` : cleaned;
}

function pascal(segment: string): string {
	return segment
		.replace(/\.[^.]*$/, '')
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map((part) => part[0]!.toUpperCase() + part.slice(1))
		.join('');
}

/**
 * @description Orders strings by code unit, unlike `localeCompare`, so output does not depend on the machine.
 * @param a The first string.
 * @param b The second string.
 * @returns A negative, zero or positive number.
 */
export function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/** Directory segments nearest-first, as PascalCase prefixes for disambiguation. */
function prefixes(component: ComponentRecord): string[] {
	if (!component.path) {
		return [`Module${component.moduleId}`];
	}

	const segments = component.path.split('/').slice(0, -1).reverse();

	return segments
		.filter((segment) => !SKIPPED_SEGMENTS.has(segment))
		.map(pascal)
		.filter((segment) => segment && !component.name.startsWith(segment));
}

/**
 * @description Sorts components into the order every later stage iterates in, so output is deterministic.
 * @param components The components.
 * @returns A new array sorted by source path, then name, then module id.
 */
export function sortComponents(components: ComponentRecord[]): ComponentRecord[] {
	return [...components].sort(
		(a, b) =>
			compare(a.path ?? '~', b.path ?? '~') ||
			compare(a.name, b.name) ||
			a.moduleId - b.moduleId,
	);
}

/**
 * @description Gives each component a unique, deterministic type name base. A name used once keeps it; a
 * shared name gains the nearest directory names of its source path until it is unique.
 * @param components The components, already sorted.
 * @returns The name base per component (the emitter appends `Props`).
 */
export function assignNames(components: ComponentRecord[]): Map<ComponentRecord, string> {
	const groups = new Map<string, ComponentRecord[]>();

	for (const component of components) {
		const base = identifier(component.name);
		const group = groups.get(base);

		if (group) {
			group.push(component);
		} else {
			groups.set(base, [component]);
		}
	}

	const names = new Map<ComponentRecord, string>();
	const taken = new Set<string>(groups.keys());

	for (const [base, group] of groups) {
		if (group.length === 1) {
			names.set(group[0]!, base);

			continue;
		}

		for (const component of group) {
			const found = prefixes(component);
			const candidates = found.map(
				(_, i) =>
					found
						.slice(0, i + 1)
						.reverse()
						.join('') + base,
			);
			let candidate =
				candidates.find((name) => !taken.has(name)) ?? candidates.at(-1) ?? base;

			for (let i = 1; taken.has(candidate); i++) {
				candidate =
					i === 1
						? `${base}_${component.moduleId}`
						: `${base}_${component.moduleId}_${i}`;
			}

			taken.add(candidate);
			names.set(component, candidate);
		}
	}

	return names;
}

export default { compare, sortComponents, assignNames };
