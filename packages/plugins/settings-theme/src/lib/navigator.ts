import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

export type ScreenOptions =
	| Record<string, unknown>
	| ((...args: never[]) => Record<string, unknown>)
	| undefined;

const TRANSPARENT = { backgroundColor: 'transparent' };
const MAX_DEPTH = 8;

function withTransparentContent(
	options: Record<string, unknown> | undefined,
): Record<string, unknown> {
	const headerStyle = typeof options?.headerStyle === 'object' ? options.headerStyle : {};

	return {
		...options,
		contentStyle: TRANSPARENT,
		headerStyle: { ...headerStyle, ...TRANSPARENT },
	};
}

/**
 * @description Makes screen options draw no background of their own, keeping every other option.
 * @param options The options.
 * @returns Options whose content and header are transparent.
 */
export function transparentOptions(options: ScreenOptions): ScreenOptions {
	if (typeof options === 'function') {
		return (...args: never[]) => withTransparentContent(options(...args));
	}

	return withTransparentContent(options);
}

type NavigatorProps = {
	id?: string;
	style?: unknown;
	screenOptions?: ScreenOptions;
	children?: ReactNode;
};
type ScreenProps = { options?: ScreenOptions };

function withTransparentScreens(children: ReactNode): ReactNode {
	return Array.isArray(children)
		? children.map(withTransparentScreens)
		: isValidElement<ScreenProps>(children) && 'name' in (children.props as object)
			? cloneElement(children, { options: transparentOptions(children.props.options) })
			: children;
}

/**
 * @description Finds the navigator with the given id in a rendered tree and makes its screens, and the views around it, transparent.
 * @param node The rendered tree.
 * @param id The navigator's id.
 * @param depth How deep the search already is.
 * @returns The tree with that navigator changed, or the tree as it was.
 */
export function withTransparentNavigator(node: ReactNode, id: string, depth = 0): ReactNode {
	if (!isValidElement<NavigatorProps>(node) || depth > MAX_DEPTH) return node;

	const { props } = node;

	if (props.id === id) {
		return cloneElement(node as ReactElement<NavigatorProps>, {
			screenOptions: transparentOptions(props.screenOptions),
			children: withTransparentScreens(props.children),
		});
	}

	if (!props.children) return node;

	const children = Array.isArray(props.children)
		? props.children.map((child) => withTransparentNavigator(child, id, depth + 1))
		: withTransparentNavigator(props.children, id, depth + 1);

	return cloneElement(node as ReactElement<NavigatorProps>, {
		children,
		...(props.style === undefined ? {} : { style: [props.style, TRANSPARENT] }),
	});
}
