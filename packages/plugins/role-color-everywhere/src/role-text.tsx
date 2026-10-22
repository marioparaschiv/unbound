import { roleColorAt, type RoleColorAppearance } from '@shared/role-colors';
import type { ReactElement } from 'react';

interface RoleTextRuntime {
	React: any;
	Text: any;
}

export function paintRoleTextTree(
	node: any,
	appearances: Map<string, RoleColorAppearance>,
	runtime: RoleTextRuntime,
	depth = 0,
): any {
	if (depth > 12 || !node) return node;
	const { React, Text } = runtime;
	if (Array.isArray(node)) {
		const next = node.map((child) => paintRoleTextTree(child, appearances, runtime, depth + 1));
		return next.some((child, index) => child !== node[index]) ? next : node;
	}
	if (!React.isValidElement(node)) return node;
	const element = node as ReactElement<any>;
	const children = element.props?.children;
	const name =
		typeof children === 'string'
			? children
			: Array.isArray(children) && children.length === 1 && typeof children[0] === 'string'
				? children[0]
				: null;
	const appearance = name ? appearances.get(name) : null;
	if (appearance?.colors.length === 1)
		return React.cloneElement(element, {
			style: [element.props.style, { color: appearance.colors[0] }],
		});
	if (appearance && name) {
		const characters = Array.from(name);
		const colored = characters.map((character, index) =>
			React.createElement(
				Text,
				{
					key: index,
					style: {
						color:
							roleColorAt(
								appearance.colors,
								characters.length === 1 ? 0 : index / (characters.length - 1),
							) ?? appearance.colors[0],
					},
				},
				character,
			),
		);
		return React.cloneElement(element, { children: colored });
	}

	const next = paintRoleTextTree(children, appearances, runtime, depth + 1);
	return next === children ? node : React.cloneElement(element, { children: next });
}
