import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

type IconProps = { icon?: ReactNode; children?: ReactNode };

type NamedComponent = { displayName?: string; name?: string; type?: NamedComponent };

const MAX_DEPTH = 3;

function componentName(node: ReactNode): string | undefined {
	if (!isValidElement(node)) return;

	const type = node.type as string | NamedComponent;

	return typeof type === 'string' ? type : (type.displayName ?? type.name ?? type.type?.name);
}

function carriesIcon(node: ReactNode, icons: Set<string>, depth = 0): boolean {
	if (!isValidElement<IconProps>(node) || depth > MAX_DEPTH) return false;

	if (icons.has(componentName(node.props.icon) ?? '')) return true;

	const children = Children.toArray(node.props.children);

	return children.some(
		(child) =>
			icons.has(componentName(child) ?? '') ||
			(children.length === 1 && carriesIcon(child, icons, depth + 1)),
	);
}

/**
 * @description Removes the buttons in a row that draw one of the given icons, such as a call button's `PhoneCallIcon`.
 * Matching by icon keeps it working in every language.
 * @param row The rendered row of buttons.
 * @param icons The icon component names whose buttons to remove.
 * @returns A copy without those buttons, or `undefined` when there was none to remove.
 */
export function withoutIconButtons(
	row: ReactNode,
	icons: Set<string>,
): ReactElement<IconProps> | undefined {
	if (!icons.size || !isValidElement<IconProps>(row)) return;

	const children = Children.toArray(row.props.children);
	const kept = children.filter((child) => !carriesIcon(child, icons));

	if (kept.length === children.length) return;

	return cloneElement(row, undefined, ...kept);
}

export default withoutIconButtons;
