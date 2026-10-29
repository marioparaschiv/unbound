/** One metro module from the decompile: its id, source path (absent for node_modules), deps and factory text. */
export type ModuleRecord = {
	id: number;
	path: string | undefined;
	deps: number[];
	source: string;
};

/** The light per-module index kept for every module, component or not, so dependency targets resolve. */
export type ModuleSummary = {
	id: number;
	path: string | undefined;
	exportNames: string[];
};

/** A value read from another module: `require(deps[i]).name`, with `name` a dotted member path. */
export type ImportRef = {
	kind: 'import';
	moduleId: number;
	name: string;
};

/** A component defined in the same module. It holds the record, since unnamed components get named last. */
export type LocalRef = {
	kind: 'local';
	component: ComponentRecord;
};

/** Where a JSX element, a forwarded prop or a static points, before cross-module resolution. */
export type TargetRef = ImportRef | LocalRef;

/** A hook call the props went through: the imported hook and the member of its result that was read. */
export type HookRef = {
	hook: ImportRef;
	member: string | undefined;
};

/** A component the rest props are spread into, and the hook they passed through on the way, if any. */
export type RestTarget = {
	target: TargetRef;
	through: HookRef | undefined;
};

/** A hook the props are passed to as its first argument, and the keys the passed object sets over them. */
export type HookCall = {
	hook: TargetRef;
	sets: string[];
};

export type ComponentKind = 'function' | 'memo' | 'forwardRef' | 'class';

export type LiteralValue = string | number | boolean | null;

/** An exported constant: a literal, or an object of them keyed by member name (`ButtonVariants.PRIMARY`). */
export type ConstantValue = LiteralValue | ConstantTable;

export type ConstantTable = Map<string, ConstantValue>;

/** One thing the decompile showed about a prop. A prop's evidence is the list of these. */
export type PropObservation =
	| { kind: 'default'; value: LiteralValue }
	| { kind: 'default-expression' }
	/** A default read from another module, resolved to `default` or `default-expression` after extraction. */
	| { kind: 'default-ref'; ref: ImportRef }
	| { kind: 'compared'; value: LiteralValue }
	/** A literal some JSX call site passes for the prop. */
	| { kind: 'passed'; value: LiteralValue }
	/** A comparison with a value from another module, resolved to `compared` (or dropped) after extraction. */
	| { kind: 'compared-ref'; ref: ImportRef }
	| { kind: 'called'; argCount: number }
	| { kind: 'forwarded'; target: TargetRef; key: string }
	| { kind: 'spread'; target: TargetRef }
	| { kind: 'member'; name: string }
	| { kind: 'guarded' }
	| { kind: 'name-only' }
	/** Its type is tested at runtime, so it may take several shapes. */
	| { kind: 'typeof' }
	/** Tested with `isValidElement`, so it may be a React element rendered as is. */
	| { kind: 'element-tested' }
	/** Passed as positional argument `index` to a function, whose parameter evidence then applies too. */
	| { kind: 'argument'; callee: TargetRef; index: number };

export type PropEvidence = PropObservation[];

/** A static attached to a component (`Button.Icon = ButtonIcon`). */
export type StaticRecord = {
	name: string;
	target: TargetRef | undefined;
	literal: LiteralValue | undefined;
};

export type ComponentRecord = {
	name: string;
	moduleId: number;
	path: string | undefined;
	exportNames: string[];
	kind: ComponentKind;
	rendersJsx: boolean;
	props: Map<string, PropEvidence>;
	/** Per positional parameter index, the evidence the body shows; argument 0 is also the props object. */
	params: Map<number, PropEvidence>;
	/** Components the rest props (or the whole props object) are spread into. */
	restTargets: RestTarget[];
	/** The props object (or its rest) is handed to a call the walk cannot follow, such as a hook. */
	propsEscape: boolean;
	hookCalls: HookCall[];
	statics: StaticRecord[];
	/** For a hook: per member of its result (`''` for the result itself) that spreads its argument, the keys set there. */
	overrides: Map<string, Set<string>>;
};

/** An export of a parsed module whose value comes from another module. */
export type ReExport = {
	exportName: string;
	target: ImportRef;
};

/** A component reachable as `require(path)[exportName]`, directly or through re-exports. */
export type ExportEntry = {
	path: string;
	exportName: string;
	component: ComponentRecord;
};

/** What extraction produced for one module. */
export type ModuleFacts = {
	moduleId: number;
	components: ComponentRecord[];
	/** Module-level lowercase functions (hooks and helpers), walked like components so their callers can be typed. */
	functions: ComponentRecord[];
	reExports: ReExport[];
	/** Literal props passed to JSX elements, attached to the target's evidence once targets resolve. */
	passed: PassedLiteral[];
	/** Exports whose value is a literal or an object of literals, by export name. */
	constants: Map<string, ConstantValue>;
	/** Modules whose every export this one copies. */
	starExports: number[];
};

/** A literal prop value at a JSX call site: `jsx(Text, { variant: 'heading-sm/normal' })`. */
export type PassedLiteral = {
	target: TargetRef;
	key: string;
	value: LiteralValue;
};
