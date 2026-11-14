import { StyleSheet } from 'react-native';

/** A view's size and corner as its style sets them. */
export type Box = { width?: number; height?: number; radius: number };

/** What corner a view with this box gets, or `undefined` to leave it as Discord drew it. */
// UNKNOWN: the owner's props are whatever Discord passed the component.
export type Rule = (box: Box, props: unknown) => number | undefined;

// UNKNOWN: a component renders any node.
type Node = unknown;

type ElementLike = { type?: unknown; props?: Record<string, unknown> };

/** A radius React Native clamps to as round as the view can be. */
export const FULL = 9999;

const MAX_DEPTH = 14;
const MAX_LEVELS = 6;
const wrappers = new WeakMap<object, Map<Rule, unknown>>();

function isElement(node: Node): node is ElementLike {
	return typeof node === 'object' && node !== null && !Array.isArray(node) && 'props' in node;
}

// UNKNOWN: a style may be a function of the press state, an array or an object.
function restingStyle(style: unknown): unknown {
	if (typeof style !== 'function') return style;

	try {
		return (style as (state: object) => unknown)({
			pressed: false,
			hovered: false,
			focused: false,
		});
	} catch {
		// A style that throws without a real press state keeps Discord's corner.
		return undefined;
	}
}

// UNKNOWN: a style may be anything React Native accepts.
function boxOf(style: unknown): Box | undefined {
	let flat: Record<string, unknown> | undefined;

	try {
		flat = StyleSheet.flatten(restingStyle(style) as never) as
			| Record<string, unknown>
			| undefined;
	} catch {
		// An unflattenable style keeps Discord's corner.
		return undefined;
	}

	const radius = flat?.borderRadius;

	if (typeof radius !== 'number' || radius <= 0) return undefined;

	return {
		width: typeof flat?.width === 'number' ? flat.width : undefined,
		height: typeof flat?.height === 'number' ? flat.height : undefined,
		radius,
	};
}

function componentName(type: unknown): string {
	const named = type as {
		displayName?: string;
		name?: string;
		type?: { displayName?: string; name?: string };
	} | null;

	return String(
		named?.displayName || named?.name || named?.type?.displayName || named?.type?.name || '',
	);
}

// UNKNOWN: a component type may be a function or a memo object.
function renderOf(type: unknown): ((props: unknown) => Node) | undefined {
	if (typeof type === 'function') {
		return (type as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent
			? undefined
			: (type as (props: unknown) => Node);
	}

	const memo = type as { type?: unknown; render?: unknown } | null;

	return memo && typeof memo === 'object' && typeof memo.type === 'function' && !memo.render
		? renderOf(memo.type)
		: undefined;
}

// UNKNOWN: a component type may be a function or a memo object.
function wrapperFor(type: unknown, rule: Rule, level: number): unknown {
	if (/REA|Animated|Reanimated|Workaround/i.test(componentName(type))) return undefined;

	const render = renderOf(type);

	if (!render || (typeof type !== 'object' && typeof type !== 'function')) return undefined;

	let byRule = wrappers.get(type as object);

	if (!byRule) {
		byRule = new Map();
		wrappers.set(type as object, byRule);
	}

	let wrapped = byRule.get(rule);

	if (!wrapped) {
		wrapped = Object.assign(
			(props: unknown) =>
				roundTree(render(props), rule, { level: level + 1, owner: props, deep: true }),
			{
				displayName: `RoundCorners(${componentName(type) || 'inner'})`,
			},
		);
		byRule.set(rule, wrapped);
	}

	return wrapped;
}

type Walk = { depth?: number; level?: number; owner?: unknown; deep?: boolean };

function roundedStyle(
	style: unknown,
	rule: Rule,
	owner: unknown,
	props: Record<string, unknown>,
): unknown {
	const box = boxOf(style);

	if (!box) return style;

	const next = box.radius > FULL ? FULL : rule(box, owner ?? props);

	if (typeof next !== 'number' || next === box.radius) return style;

	return typeof style === 'function'
		? (state: object) => [(style as (state: object) => unknown)(state), { borderRadius: next }]
		: [style, { borderRadius: next }];
}

/**
 * @description Copies a component's rendered tree with every corner its rule picks re-rounded, never editing the cached tree in place.
 * @param node The rendered tree.
 * @param rule The corner rule for this component's views.
 * @param walk How deep the walk is, the owner's props, and whether to wrap inner components a few levels down.
 * @returns The rounded copy, or the same tree when nothing changed.
 */
export function roundTree(
	node: Node,
	rule: Rule,
	{ depth = 0, level = 0, owner, deep = false }: Walk = {},
): Node {
	if (depth > MAX_DEPTH || !node || typeof node !== 'object') return node;

	if (Array.isArray(node)) {
		let changed = false;
		const out = node.map((child: Node) => {
			const next = roundTree(child, rule, { depth: depth + 1, level, owner, deep });

			changed ||= next !== child;

			return next;
		});

		return changed ? out : node;
	}

	if (!isElement(node) || !node.props) return node;

	const { props } = node;
	const style = roundedStyle(props.style, rule, owner, props);
	const children = roundTree(props.children, rule, { depth: depth + 1, level, owner, deep });
	const type =
		deep && level < MAX_LEVELS && typeof node.type !== 'string'
			? wrapperFor(node.type, rule, level)
			: undefined;

	if (style === props.style && children === props.children && !type) return node;

	return { ...node, ...(type ? { type } : {}), props: { ...props, style, children } };
}

/** The corner rules targets share. */
export const rules = {
	/** A square up to `max` dp becomes a circle. */
	circleIfSquare:
		(max: number): Rule =>
		({ width, height, radius }) =>
			width !== undefined &&
			height !== undefined &&
			Math.abs(width - height) < 1 &&
			width <= max &&
			radius < width / 2
				? width / 2
				: undefined,
	/** Any corner of at least `min` becomes fully round, a circle or a pill, without knowing the view's size. */
	fullRoundIf:
		(min: number): Rule =>
		({ radius }) =>
			radius >= min && radius < FULL ? FULL : undefined,
};

export default roundTree;
