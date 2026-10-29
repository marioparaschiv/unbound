import type { ts } from 'ts-morph';

import type {
	ComponentRecord,
	HookRef,
	ImportRef,
	LiteralValue,
	PassedLiteral,
	TargetRef,
} from './types';

/** A function expression seen in a module, walked after the function that defines it finishes. */
export type FunctionInfo = {
	node: ts.FunctionExpression;
	name: string | undefined;
	/** Set for PascalCase functions: the component this copy belongs to. */
	component: ComponentRecord | undefined;
	/** Set when the function is a class method (`_createClass(Ctor, [{ key, value }])`). */
	owner: ComponentRecord | undefined;
	returns: Value[];
	/** Whether a register holding the function was read; an unread one may be a branch copy. */
	read: boolean;
};

/** An object literal under construction: its literal keys in order (for slot fills), entries and spreads. */
export type ObjectBuild = {
	keys: string[];
	entries: Map<string, Value>;
	spreads: Value[];
};

/** Per-module state shared by every function walked in it. */
export type ModuleContext = {
	moduleId: number;
	path: string | undefined;
	deps: number[];
	text: string;
	file: ts.SourceFile;
	slots: Map<string, Value>;
	components: Map<string, ComponentRecord>;
	exports: ExportBinding[];
	/** Modules whose every export this one copies (`for (k in m) exports[k] = m[k]`). */
	starExports: number[];
	getters: GetterBinding[];
	staticOwners: StaticOwner[];
	displayNames: Map<ComponentRecord, string>;
	passed: PassedLiteral[];
};

export type ExportBinding = { name: string; value: Value };
/** `parent[key] = component`: names an unnamed component after its parent. */
export type StaticOwner = { component: ComponentRecord; parent: ComponentRecord; key: string };
export type GetterBinding = { name: string; fn: FunctionInfo };

/** A prop read; `fallback` is the prop that stands in when it is unset (`label ?? accessibilityLabel`). */
export type PropValue = {
	kind: 'prop';
	component: ComponentRecord;
	name: string;
	fallback?: PropValue;
};

/** A test of whether the prop in `register` is set: strict against `undefined`, or loose against `null`. */
export type PresenceTest = {
	kind: 'presence';
	prop: PropValue;
	register: string;
	present: boolean;
};

/** What a register, closure slot or expression holds, as far as one textual pass can tell. */
export type Value =
	| { kind: 'unknown' }
	| { kind: 'literal'; value: LiteralValue | undefined }
	| { kind: 'param'; index: number }
	| { kind: 'builtin'; path: string }
	| { kind: 'dep'; index: number }
	| { kind: 'module'; moduleId: number; interop: boolean }
	/** A member of a required module under a computed key, as in an export-star loop. */
	| { kind: 'star'; moduleId: number }
	| ImportRef
	| { kind: 'jsx' }
	| { kind: 'wrapper'; wrapper: 'memo' | 'forwardRef' }
	| { kind: 'function'; fn: FunctionInfo }
	| { kind: 'wrapped'; fn: FunctionInfo; wrapper: 'memo' | 'forwardRef' }
	| { kind: 'props'; component: ComponentRecord }
	| PropValue
	| { kind: 'instance'; component: ComponentRecord }
	/** The result of a call that received a component's props, such as `useTextField(rest)` or a compiled rest helper. */
	| { kind: 'derived'; component: ComponentRecord; through: HookRef | undefined }
	/** `undefined !== rP` or `null == rP`: a nullish test of a prop, true when the prop is `present` or absent. */
	| PresenceTest
	| { kind: 'object'; object: ObjectBuild }
	| { kind: 'array'; items: Value[] }
	| { kind: 'element' };

/** A value carrying a component's props: the props object itself or a call result derived from it. */
export type PropsSource = Extract<Value, PropsSourceKind>;

type PropsSourceKind = { kind: 'props' | 'derived' };

export const UNKNOWN: Value = { kind: 'unknown' };

const JSX_FACTORIES = new Set(['jsx', 'jsxs', 'createElement']);
const WRAPPERS = new Set(['memo', 'forwardRef']);

/**
 * @description Reads a named member off a value, mapping module members to imports and imports to dotted paths.
 * @param base The value read from.
 * @param name The member name.
 * @returns The member's value.
 */
export function member(base: Value, name: string): Value {
	if (base.kind === 'module' || base.kind === 'import') {
		const path =
			base.kind === 'module'
				? base.interop
					? `default.${name}`
					: name
				: `${base.name}.${name}`;

		if (JSX_FACTORIES.has(name)) {
			return { kind: 'jsx' };
		}

		if (WRAPPERS.has(name)) {
			return { kind: 'wrapper', wrapper: name as 'memo' | 'forwardRef' };
		}

		return { kind: 'import', moduleId: base.moduleId, name: path };
	}

	if (base.kind === 'builtin') {
		return { kind: 'builtin', path: `${base.path}.${name}` };
	}

	if (base.kind === 'props') {
		return { kind: 'prop', component: base.component, name };
	}

	// A hook result's members are not props, but spreading them still forwards props. Only the first member read
	// is tracked, since a hook summary describes its result one level deep.
	if (base.kind === 'derived') {
		const through =
			base.through?.member === undefined && base.through
				? { hook: base.through.hook, member: name }
				: undefined;

		return { kind: 'derived', component: base.component, through };
	}

	if (base.kind === 'instance' && name === 'props') {
		return { kind: 'props', component: base.component };
	}

	if (base.kind !== 'object') {
		return UNKNOWN;
	}

	// A key the literal does not set may come from a spread props object.
	const spread = base.object.spreads
		.map((source) => member(source, name))
		.find((value) => value.kind === 'prop');

	return base.object.entries.get(name) ?? spread ?? UNKNOWN;
}

/**
 * @description Resolves what a JSX element type or a static value points at.
 * @param value The value used as the element type.
 * @returns The target, or undefined when it is not a component reference.
 */
export function targetOf(value: Value): TargetRef | undefined {
	if (value.kind === 'import') {
		return { kind: 'import', moduleId: value.moduleId, name: value.name };
	}

	if (value.kind === 'module') {
		// `module.exports = Component` and an interop default both surface as the `default` export.
		return { kind: 'import', moduleId: value.moduleId, name: 'default' };
	}

	if ((value.kind === 'function' || value.kind === 'wrapped') && value.fn.component) {
		return { kind: 'local', component: value.fn.component };
	}

	return undefined;
}

/**
 * @description Lists the props objects a value spreads, following nested object spreads.
 * @param value A props object passed to JSX, or a spread source.
 * @returns The props objects, or values derived from them, that flow into the value.
 */
export function spreadSources(value: Value): PropsSource[] {
	if (value.kind === 'props' || value.kind === 'derived') {
		return [value];
	}

	if (value.kind !== 'object') {
		return [];
	}

	return value.object.spreads.flatMap(spreadSources);
}

export default { UNKNOWN, member, targetOf, spreadSources };
