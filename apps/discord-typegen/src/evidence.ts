import type {
	ComponentRecord,
	ConstantValue,
	LiteralValue,
	ModuleFacts,
	PropEvidence,
	PropObservation,
	ReExport,
	TargetRef,
} from './types';
import type { ModuleContext, PropValue, Value } from './values';
import type { Resolver } from './resolve';

import { UNKNOWN, spreadSources, targetOf } from './values';
import { constantOf } from './constants';

/** What a module's exports are, besides its components: values from other modules, and constants. */
export type BoundExports = {
	reExports: ReExport[];
	constants: Map<string, ConstantValue>;
	starExports: number[];
};

const MODULE = 4;
const EXPORTS = 5;
const HOOK_NAME = /^use[A-Z]/;

/**
 * @description Tells whether a function name follows React's hook convention (`useTextField`).
 * @param name The function's name.
 * @returns True for hook names.
 */
export function isHookName(name: string): boolean {
	return HOOK_NAME.test(name);
}

/**
 * @description Appends one observation to a prop's evidence.
 * @param prop The prop the observation is about.
 * @param observation What was observed.
 */
export function observe(prop: PropValue, observation: PropObservation) {
	const evidence = prop.component.props.get(prop.name);

	if (evidence) {
		evidence.push(observation);
	} else {
		prop.component.props.set(prop.name, [observation]);
	}
}

/**
 * @description Returns the module's record for a component name, creating it on first sight.
 * Every copy of a function with the same original name (the React Compiler branch and the plain one) shares it.
 * @param ctx The module.
 * @param name The component's original name.
 * @returns The shared record.
 */
export function componentFor(ctx: ModuleContext, name: string): ComponentRecord {
	let component = ctx.components.get(name);

	if (!component) {
		component = {
			name,
			moduleId: ctx.moduleId,
			path: ctx.path,
			exportNames: [],
			kind: 'function',
			rendersJsx: false,
			props: new Map(),
			restTargets: [],
			propsEscape: false,
			hookCalls: [],
			statics: [],
			overrides: new Map(),
		};
		ctx.components.set(name, component);
	}

	return component;
}

/**
 * @description Records a JSX element: marks the rendering component, forwarded props and spread props.
 * @param ctx The module.
 * @param renderer The component the element is rendered by, if any.
 * @param type The element type.
 * @param props The props object passed to the JSX factory.
 * @returns The element value.
 */
export function element(
	ctx: ModuleContext,
	renderer: ComponentRecord | undefined,
	type: Value,
	props: Value,
): Value {
	if (renderer) {
		renderer.rendersJsx = true;
	}

	const target = targetOf(type);

	if (target) {
		for (const source of spreadSources(props)) {
			const through = source.kind === 'derived' ? source.through : undefined;

			source.component.restTargets.push({ target, through });
		}

		const entries = props.kind === 'object' ? props.object.entries : [];

		for (const [key, value] of entries) {
			forward(value, target, key);

			// `null` is the placeholder Hermes slot-fills later, so it says nothing about the prop's type.
			if (value.kind === 'literal' && value.value !== undefined && value.value !== null) {
				ctx.passed.push({ target, key, value: value.value });
			}
		}
	}

	return { kind: 'element' };
}

function forward(value: Value, target: TargetRef, key: string) {
	if (value.kind === 'prop') {
		observe(value, { kind: 'forwarded', target, key });

		if (value.fallback) {
			forward(value.fallback, target, key);
		}

		return;
	}

	// Style arrays and children arrays keep the element type of the target prop.
	if (value.kind !== 'array' || !(key === 'children' || /style$/i.test(key))) return;

	for (const item of value.items) {
		if (item?.kind === 'prop') {
			observe(item, { kind: 'forwarded', target, key });
		}
	}
}

/**
 * @description Attaches each literal passed at a JSX call site to the prop of the component it resolves to.
 * Only props the component reads gain evidence, so a call site never invents a prop. A value counts once per
 * module, so an observation count is how many modules pass it, not how many compiled copies of a call there are.
 * @param facts The extracted modules.
 * @param resolve The cross-module resolver.
 */
export function bindPassed(facts: ModuleFacts[], resolve: Resolver) {
	for (const module of facts) {
		const seen = new Map<PropEvidence, Set<LiteralValue>>();

		for (const { target, key, value } of module.passed) {
			const resolved = resolve(target);
			const evidence =
				resolved?.kind === 'component' ? resolved.component.props.get(key) : undefined;

			if (!evidence) {
				continue;
			}

			const values = seen.get(evidence) ?? new Set();

			if (values.has(value)) {
				continue;
			}

			values.add(value);
			seen.set(evidence, values);
			evidence.push({ kind: 'passed', value });
		}
	}
}

/**
 * @description Records which keys a hook sets over its spread argument in what it returns, so a component spreading
 * that result knows those keys no longer come from its own props.
 * @param hook The hook's record.
 * @param returns The values the hook returns.
 */
export function recordOverrides(hook: ComponentRecord, returns: Value[]) {
	for (const value of returns) {
		addOverrides(hook, value, '');

		if (value.kind !== 'object') {
			continue;
		}

		for (const [key, entry] of value.object.entries) {
			addOverrides(hook, entry, key);
		}
	}
}

function addOverrides(hook: ComponentRecord, value: Value, member: string) {
	if (value.kind !== 'object') return;

	const spreadsArgument = value.object.spreads
		.flatMap(spreadSources)
		.some((source) => source.kind === 'props' && source.component === hook);

	if (!spreadsArgument) return;

	const keys = hook.overrides.get(member) ?? new Set();

	for (const key of value.object.entries.keys()) keys.add(key);

	hook.overrides.set(member, keys);
}

/**
 * @description Records a hook call whose first argument is the props, or an object spreading them, so the caller
 * can inherit the keys the hook reads from it.
 * @param hook The called hook.
 * @param argument The first argument.
 */
export function recordHookCall(hook: TargetRef, argument: Value | undefined) {
	if (!argument) return;

	const sets = argument.kind === 'object' ? [...argument.object.entries.keys()] : [];

	for (const source of spreadSources(argument)) {
		if (source.kind === 'props') {
			source.component.hookCalls.push({ hook, sets });
		}
	}
}

/**
 * @description Handles `base[name] = value` for the bases that matter: exports, `module.exports`, object
 * literals under construction and components (statics, `defaultProps`).
 * @param ctx The module.
 * @param base The object written to.
 * @param name The key.
 * @param value The value written.
 */
export function assignKey(ctx: ModuleContext, base: Value, name: string, value: Value) {
	if (base.kind === 'param' && base.index === EXPORTS) {
		ctx.exports.push({ name, value });

		return;
	}

	if (base.kind === 'param' && base.index === MODULE && name === 'exports') {
		ctx.exports.push({ name: 'default', value });

		return;
	}

	if (base.kind === 'object') {
		base.object.entries.set(name, value);

		return;
	}

	if ((base.kind === 'function' || base.kind === 'wrapped') && base.fn.component) {
		addStatic(ctx, base.fn.component, name, value);
	}
}

/**
 * @description Handles `base[key] = value` with a computed key: an export-star loop copying another module's exports.
 * @param ctx The module.
 * @param base The object written to.
 * @param value The value written.
 */
export function assignComputed(ctx: ModuleContext, base: Value, value: Value) {
	if (base.kind === 'param' && base.index === EXPORTS && value.kind === 'star') {
		ctx.starExports.push(value.moduleId);
	}
}

function addStatic(ctx: ModuleContext, component: ComponentRecord, name: string, value: Value) {
	if (name === 'defaultProps' && value.kind === 'object') {
		for (const [prop, entry] of value.object.entries) {
			const target: PropValue = { kind: 'prop', component, name: prop };

			if (entry.kind === 'literal' && entry.value !== undefined) {
				observe(target, { kind: 'default', value: entry.value });
			} else if (entry.kind === 'import') {
				observe(target, { kind: 'default-ref', ref: entry });
			}
		}

		return;
	}

	if (name === 'displayName' && value.kind === 'literal' && typeof value.value === 'string') {
		ctx.displayNames.set(component, value.value);
	}

	if (name === 'displayName' || name === 'propTypes') return;

	if ((value.kind === 'function' || value.kind === 'wrapped') && value.fn.component) {
		ctx.staticOwners.push({ component: value.fn.component, parent: component, key: name });
	}

	component.statics.push({
		name,
		target: targetOf(value),
		literal: value.kind === 'literal' && value.value !== undefined ? value.value : void 0,
	});
}

/**
 * @description Applies `memo(...)` or `forwardRef(...)` to a component function.
 * @param wrapper The wrapper called.
 * @param inner Its argument.
 * @returns The wrapped component, keeping `forwardRef` when the inner value already had it.
 */
export function wrap(wrapper: 'memo' | 'forwardRef', inner: Value | undefined): Value {
	if (inner?.kind !== 'function' && inner?.kind !== 'wrapped') {
		return UNKNOWN;
	}

	const forwardsRef =
		wrapper === 'forwardRef' || (inner.kind === 'wrapped' && inner.wrapper === 'forwardRef');
	const kind = forwardsRef ? 'forwardRef' : 'memo';

	if (inner.fn.component) {
		inner.fn.component.kind = kind;
	}

	return { kind: 'wrapped', fn: inner.fn, wrapper: kind };
}

/**
 * @description Records `Object.defineProperty(exports, name, { get })`, resolved once the getter is walked.
 * @param ctx The module.
 * @param args The call's arguments.
 */
export function defineExport(ctx: ModuleContext, args: Value[]) {
	const [base, name, descriptor] = args;

	if (base?.kind !== 'param' || base.index !== EXPORTS) return;

	if (name?.kind !== 'literal' || typeof name.value !== 'string') return;

	const getter = descriptor?.kind === 'object' ? descriptor.object.entries.get('get') : undefined;

	if (getter?.kind === 'function') {
		ctx.getters.push({ name: name.value, fn: getter.fn });
	}
}

/**
 * @description Ties Babel class methods to their class: `_createClass(Ctor, [{ key, value }])`.
 * @param args The call's arguments.
 */
export function bindClassMethods(args: Value[]) {
	const [ctor] = args;

	if (ctor?.kind !== 'function' || !ctor.fn.component) return;

	for (const arg of args) {
		if (arg.kind !== 'array') {
			continue;
		}

		for (const item of arg.items) {
			const method = item?.kind === 'object' ? item.object.entries.get('value') : undefined;

			if (method?.kind !== 'function') {
				continue;
			}

			method.fn.owner = ctor.fn.component;
			ctor.fn.component.kind = 'class';
		}
	}
}

/**
 * @description Applies the module's export assignments and export getters to its components.
 * @param ctx The walked module.
 * @returns The exports whose value is read from another module, and the exported constants.
 */
export function bindExports(ctx: ModuleContext): BoundExports {
	const reExports: ReExport[] = [];
	const constants = new Map<string, ConstantValue>();
	const bindings = [
		...ctx.exports,
		...ctx.getters.flatMap(({ name, fn }) => fn.returns.map((value) => ({ name, value }))),
	];

	for (const { name, value } of bindings) {
		if ((value.kind === 'function' || value.kind === 'wrapped') && value.fn.component) {
			value.fn.component.exportNames.push(name);
		} else if (value.kind === 'import') {
			reExports.push({ exportName: name, target: value });
		} else {
			const constant = constantOf(value);

			if (constant !== undefined) {
				constants.set(name, constant);
			}
		}
	}

	return { reExports, constants, starExports: ctx.starExports };
}

/**
 * @description Names the module's unnamed components (builds stripped of function names) from their export
 * name, `displayName`, the static they are attached to, or the file name of a default export.
 * @param ctx The walked module, after its exports are bound.
 * @returns The module's components that have a PascalCase name; the rest are dropped.
 */
export function nameComponents(ctx: ModuleContext): ComponentRecord[] {
	const unnamed = [...ctx.components.values()].filter((component) => isProvisional(component));

	for (const component of unnamed) {
		const exported = [...new Set(component.exportNames)]
			.sort()
			.find((name) => name !== 'default');
		const fallback = component.exportNames.includes('default') ? fileName(ctx.path) : undefined;
		const name = ctx.displayNames.get(component) ?? exported ?? fallback;

		if (name) {
			component.name = name;
		}
	}

	for (const { component, parent, key } of ctx.staticOwners) {
		if (isProvisional(component) && !isProvisional(parent)) {
			component.name = parent.name + key;
		}
	}

	return [...ctx.components.values()].filter((component) => /^[A-Z]/.test(component.name));
}

function isProvisional(component: ComponentRecord): boolean {
	return component.name.startsWith('#');
}

function fileName(path: string | undefined): string | undefined {
	const segments = path?.split('/') ?? [];
	const base = segments.at(-1)?.replace(/\..*$/, '');

	return base === 'index' ? segments.at(-2) : base;
}

export default {
	isHookName,
	recordOverrides,
	recordHookCall,
	nameComponents,
	observe,
	componentFor,
	element,
	assignKey,
	assignComputed,
	wrap,
	defineExport,
	bindClassMethods,
	bindExports,
	bindPassed,
};
