import type { ComponentRecord, HookRef } from './types';
import type { InferEnv, InferredType } from './rules';
import type { Resolved, Resolver } from './resolve';
import type { HostProps } from './hosts';

import { createHookReads } from './hook-args';
import { RULES, literalType } from './rules';

/** What rest props can be typed from: a generated component or a React Native host. */
export type RestBase = Extract<Resolved, RestBaseKind>;

type RestBaseKind = { kind: 'component' | 'host' };

/** The typed view of the build the emitter prints. */
export type Inference = {
	/** The one component or host each component's rest props are typed from; acyclic by construction. */
	restOf: Map<ComponentRecord, RestBase>;
	/** Keys the rest edge drops because a hook between sets them over the props, sorted. */
	restOmits: Map<ComponentRecord, string[]>;
	/** Components that may read props the walk could not see: escaped props, or rest flowing somewhere untyped. */
	open: Set<ComponentRecord>;
	typeOf: (component: ComponentRecord, name: string) => InferredType;
};

/**
 * @description Infers every prop of every emitted component by running the rule table in order.
 * A prop forwarded to another component's typed prop references it (`TableRowProps['variant']`); lookups
 * recurse depth-first through the whole build and a lookup that would close a cycle counts as untyped,
 * so references always bottom out in a non-reference type.
 * @param components The emitted components, sorted.
 * @param resolve The cross-module resolver.
 * @param hosts React Native host props.
 * @param names The type name base per component.
 * @returns The inference.
 */
export function infer(
	components: ComponentRecord[],
	resolve: Resolver,
	hosts: HostProps,
	names: Map<ComponentRecord, string>,
): Inference {
	const restOf = new Map<ComponentRecord, RestBase>();
	const restOmits = new Map<ComponentRecord, string[]>();

	function reaches(from: ComponentRecord, to: ComponentRecord): boolean {
		let at: Resolved | undefined = { kind: 'component', component: from };

		while (at?.kind === 'component' && at.component !== to) {
			at = restOf.get(at.component);
		}

		return at?.kind === 'component';
	}

	// A rest edge must name an emitted component or a known host and must not close a cycle.
	function acceptable(
		component: ComponentRecord,
		resolved: Resolved | undefined,
	): resolved is RestBase {
		if (resolved?.kind === 'host') {
			return hosts.has(resolved.name);
		}

		return (
			resolved?.kind === 'component' &&
			names.has(resolved.component) &&
			!reaches(resolved.component, component)
		);
	}

	function overridden(through: HookRef | undefined): string[] {
		const resolved = through ? resolve(through.hook) : undefined;
		const keys =
			resolved?.kind === 'hook'
				? resolved.hook.overrides.get(through?.member ?? '')
				: undefined;

		return [...(keys ?? [])].sort();
	}

	for (const component of components) {
		for (const { target, through } of component.restTargets) {
			const resolved = resolve(target);

			if (!acceptable(component, resolved)) {
				continue;
			}

			restOf.set(component, resolved);
			restOmits.set(component, overridden(through));

			break;
		}
	}

	// Whether a key of the props still reaches the rest base, which then types it.
	function reachesBase(component: ComponentRecord, key: string): boolean {
		const rest = restOf.get(component);

		if (!rest || restOmits.get(component)?.includes(key)) {
			return false;
		}

		if (rest.kind === 'host') {
			return hosts.get(rest.name)?.has(key) ?? false;
		}

		return rest.component.props.has(key) || reachesBase(rest.component, key);
	}

	const hookReads = createHookReads(resolve);
	const adopted = new Set<ComponentRecord>();

	// A key a hook reads from the props becomes the component's own, unless the base already declares it. Bases
	// adopt first, so the check sees their final keys.
	function adopt(component: ComponentRecord) {
		if (adopted.has(component)) return;

		adopted.add(component);

		const rest = restOf.get(component);

		if (rest?.kind === 'component') {
			adopt(rest.component);
		}

		for (const [key, evidence] of hookReads(component)) {
			if (!component.props.has(key) && !reachesBase(component, key)) {
				component.props.set(key, [...evidence]);
			}
		}
	}

	for (const component of components) {
		adopt(component);
	}

	function isOpen(component: ComponentRecord): boolean {
		const rest = restOf.get(component);
		const unseen = component.propsEscape || (component.restTargets.length > 0 && !rest);

		return unseen || (rest?.kind === 'component' && isOpen(rest.component));
	}

	const open = new Set(components.filter((component) => isOpen(component)));

	const memo = new Map<ComponentRecord, Map<string, InferredType | null>>();

	function hasTypedKey(component: ComponentRecord, key: string): boolean {
		if (component.props.has(key)) {
			const type = typeOf(component, key);

			return type !== undefined && type.rule !== 'unknown';
		}

		const rest = restOf.get(component);

		if (restOmits.get(component)?.includes(key)) {
			return false;
		}

		if (rest?.kind === 'host') {
			return hosts.get(rest.name)?.has(key) ?? false;
		}

		return rest ? hasTypedKey(rest.component, key) : false;
	}

	const env: InferEnv = {
		componentProp(target, key) {
			const resolved = resolve(target);

			if (resolved?.kind !== 'component') return;

			const name = names.get(resolved.component);

			if (!name || !hasTypedKey(resolved.component, key)) return;

			return {
				text: `${name}Props[${literalType(key)}]`,
				rule: 'forwarded',
				refs: [{ kind: 'component', component: resolved.component }],
			};
		},
		hostProp(target, key) {
			const resolved = resolve(target);

			if (resolved?.kind !== 'host' || !hosts.get(resolved.name)?.has(key)) return;

			return {
				text: `React.ComponentProps<typeof RN.${resolved.name}>[${literalType(key)}]`,
				rule: 'host',
				refs: [{ kind: 'host' }],
			};
		},
	};

	// Returns undefined only while the prop is itself being inferred further up the stack (a cycle).
	function typeOf(component: ComponentRecord, name: string): InferredType | undefined {
		let props = memo.get(component);

		if (!props) {
			props = new Map();
			memo.set(component, props);
		}

		const known = props.get(name);

		if (known !== undefined) {
			return known ?? undefined;
		}

		props.set(name, null);

		const input = { component, name, evidence: component.props.get(name) ?? [] };
		let result: InferredType | undefined;

		for (const rule of RULES) {
			result ??= rule.infer(input, env);
		}

		props.set(name, result!);

		return result;
	}

	return { restOf, restOmits, open, typeOf: (component, name) => typeOf(component, name)! };
}

export default { infer };
