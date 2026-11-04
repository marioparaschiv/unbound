import {
	roleColorRuns,
	type RoleColorAppearance,
} from '@unbound-plugins/shared/colors/role-colors';
import {
	cloneElement,
	createElement,
	isValidElement,
	type ElementType,
	type ReactNode,
} from 'react';

type TextProps = {
	children?: ReactNode;
	style?: unknown;
};

function onlyString(children: ReactNode): string | null {
	if (typeof children === 'string') return children;

	if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
		return children[0];
	}

	return null;
}

/**
 * @description Paints every text element in a tree whose whole content is a known name with that name's role colors.
 * @param node The rendered tree to paint.
 * @param appearances The role colors to use, keyed by the exact name text.
 * @param Text The text component used to paint a gradient one character at a time.
 * @param depth How deep the walk already is; it stops after 12 levels.
 * @returns The painted tree, or `node` itself when nothing matched.
 */
export function paintRoleTextTree(
	node: ReactNode,
	appearances: Map<string, RoleColorAppearance>,
	Text: ElementType,
	depth: number = 0,
): ReactNode {
	if (depth > 12 || !node) return node;

	if (Array.isArray(node)) {
		const next = node.map((child) => paintRoleTextTree(child, appearances, Text, depth + 1));

		return next.some((child, index) => child !== node[index]) ? next : node;
	}

	if (!isValidElement<TextProps>(node)) return node;

	const { children, style } = node.props;
	const name = onlyString(children);
	const appearance = name ? appearances.get(name) : undefined;

	if (name && appearance?.colors.length === 1) {
		return cloneElement(node, { style: [style, { color: appearance.colors[0] }] });
	}

	if (name && appearance) {
		const runs = roleColorRuns(name, appearance.colors).map((run, index) =>
			createElement(Text, { key: index, style: { color: run.color } }, run.text),
		);

		return cloneElement(node, { children: runs });
	}

	const next = paintRoleTextTree(children, appearances, Text, depth + 1);

	return next === children ? node : cloneElement(node, { children: next });
}

/**
 * @description Renders a name as text painted with a role's colors.
 * @param name The name to render.
 * @param appearance The role colors to paint it with.
 * @param Text The text component to render with.
 * @returns The painted text element.
 */
export function paintRoleText(
	name: string,
	appearance: RoleColorAppearance,
	Text: ElementType,
): ReactNode {
	return paintRoleTextTree(createElement(Text, null, name), new Map([[name, appearance]]), Text);
}

export default { paintRoleTextTree, paintRoleText };
