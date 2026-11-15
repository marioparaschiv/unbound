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
		headerTransparent: true,
	};
}

/**
 * @description Makes screen options draw no background of their own and lay the header over the content, keeping every other option.
 * @param options The options.
 * @returns Options whose content and header are transparent.
 */
export function transparentOptions(options: ScreenOptions): ScreenOptions {
	if (typeof options === 'function') {
		return (...args: never[]) => withTransparentContent(options(...args));
	}

	return withTransparentContent(options);
}

export type ScreenLayout = (props: { children: ReactNode }) => ReactNode;

type NavigatorProps = {
	id?: string;
	style?: unknown;
	screenOptions?: ScreenOptions;
	screenLayout?: ScreenLayout;
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

function wrapLayout(own: ScreenLayout | undefined, layout: ScreenLayout): ScreenLayout {
	return ({ children }) => layout({ children: own ? own({ children }) : children });
}

/**
 * @description Finds the navigator with the given id in a rendered tree, makes its screens and the views around it transparent,
 * and wraps each screen in `layout`.
 * @param node The rendered tree.
 * @param id The navigator's id.
 * @param layout Draws each screen, around Discord's own layout.
 * @param depth How deep the search already is.
 * @returns The tree with that navigator changed, or the tree as it was.
 */
export function withTransparentNavigator(
	node: ReactNode,
	id: string,
	layout: ScreenLayout,
	depth = 0,
): ReactNode {
	if (!isValidElement<NavigatorProps>(node) || depth > MAX_DEPTH) return node;

	const { props } = node;

	if (props.id === id) {
		return cloneElement(node as ReactElement<NavigatorProps>, {
			screenOptions: transparentOptions(props.screenOptions),
			screenLayout: wrapLayout(props.screenLayout, layout),
			children: withTransparentScreens(props.children),
		});
	}

	if (!props.children) return node;

	const children = Array.isArray(props.children)
		? props.children.map((child) => withTransparentNavigator(child, id, layout, depth + 1))
		: withTransparentNavigator(props.children, id, layout, depth + 1);

	return cloneElement(node as ReactElement<NavigatorProps>, {
		children,
		...(props.style === undefined ? {} : { style: [props.style, TRANSPARENT] }),
	});
}
