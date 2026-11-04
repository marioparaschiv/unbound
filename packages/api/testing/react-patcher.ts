import type { AnyObject, PatchParent, ReactPatcher } from '../src/patcher';

type PatchKind = 'before' | 'instead' | 'after';

// UNKNOWN: a patched render takes and returns whatever the component under test does.
type Method = (...args: never[]) => unknown;

/** The context the recording patcher hands a method patch. */
export type MethodContext = {
	args: never[];
	this: PatchParent;
	original: Method;
	result: unknown;
};

// UNKNOWN: a method patch returns whatever the test's patch returns.
type MethodCallback = (context: MethodContext) => unknown;

/** Where a patch lands once its target is known: the object holding the method, the method, and the callback to run. */
export type Placement = { parent: PatchParent; method: string; callback: MethodCallback };

/** Patches what `place` finds on the target, waiting for a lazy handle's module as the client's `patchWhenLoaded` does. */
export type Install = (
	kind: PatchKind,
	target: PatchParent,
	place: (module: PatchParent) => Placement,
	/** The method's name, listed for the patch while it waits for its module. */
	method?: string,
) => () => void;

type Render = { parent: PatchParent; method: string; isClass: boolean };

// UNKNOWN: the props, instance and tree of a component under test are whatever it renders with.
type ReactContext = {
	props: unknown;
	this: unknown;
	result: unknown;
	original: ReactRender;
};

// UNKNOWN: renders the untyped component with untyped props.
type ReactRender = (props?: unknown) => unknown;

// UNKNOWN: a React patch returns a tree or new props.
type ReactCallback = (context: ReactContext) => unknown;

const MEMO = Symbol.for('react.memo');
const FORWARD_REF = Symbol.for('react.forward_ref');

function isCallback(value: unknown): value is ReactCallback {
	return typeof value === 'function';
}

// UNKNOWN: any export, function or not, may be a class component.
function isClass(component: unknown): boolean {
	return typeof component === 'function' && Boolean(component.prototype?.isReactComponent);
}

// Unwraps `memo` to what React calls, as the client's patcher does: the inner function, a `forwardRef`'s `render`, or a class's `prototype.render`.
function renderOf(component: AnyObject | undefined): Render | undefined {
	if (isClass(component)) {
		return { parent: component?.prototype, method: 'render', isClass: true };
	}

	if (component?.$$typeof === FORWARD_REF) {
		return { parent: component, method: 'render', isClass: false };
	}

	if (component?.$$typeof !== MEMO) return;

	return typeof component.type === 'function' && !isClass(component.type)
		? { parent: component, method: 'type', isClass: false }
		: renderOf(component.type);
}

function locate(target: AnyObject, key: string | undefined): Render {
	const component = key === undefined ? target : target[key];
	const render =
		key !== undefined && typeof component === 'function' && !isClass(component)
			? { parent: target, method: key, isClass: false }
			: renderOf(component);

	if (!render) {
		throw new TypeError(
			`Failed to patch component ${key ?? String(component)}: pass the object holding a function component and its key.`,
		);
	}

	return render;
}

/**
 * @description Builds `patcher.react` on a recording patcher, so React patches wrap the render for real and are listed with the others.
 * @param install The recording patcher's install, which defers a patch on a lazy handle until its module registers.
 * @returns The `before`, `instead` and `after` hooks for React components.
 */
export function createReactPatcher(install: Install): ReactPatcher {
	function hook(kind: PatchKind) {
		return (target: AnyObject, ...args: unknown[]) => {
			const [key, callback] = isCallback(args[0])
				? [undefined, args[0]]
				: [String(args[0]), args[1]];

			if (!isCallback(callback)) {
				throw new TypeError('Failed to patch a component: pass a callback.');
			}

			return install(
				kind,
				target,
				(module) => {
					const render = locate(module, key);

					return {
						parent: render.parent,
						method: render.method,
						callback(context) {
							const props = render.isClass
								? Reflect.get(context.this, 'props')
								: context.args[0];
							const rest = context.args.slice(1);
							const value = callback({
								props,
								this: render.isClass ? context.this : undefined,
								result: context.result,
								original: (next = props) =>
									render.isClass
										? context.original()
										: context.original(...([next, ...rest] as never[])),
							});

							if (kind !== 'before') {
								return value;
							}

							return !render.isClass && value !== undefined
								? [value, ...rest]
								: undefined;
						},
					};
				},
				key,
			);
		};
	}

	const patcher: ReactPatcher = {
		before: hook('before'),
		instead: hook('instead'),
		after: hook('after'),
	};

	return patcher;
}
