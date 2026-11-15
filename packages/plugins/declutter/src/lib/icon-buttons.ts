import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

type IconProps = { icon?: ReactNode; children?: ReactNode };

type NamedComponent = { displayName?: string; name?: string; type?: NamedComponent };

const MAX_DEPTH = 3;
const MAX_ROW_DEPTH = 4;

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

function pruneRow(
	row: ReactNode,
	icons: Set<string>,
	depth: number,
): ReactElement<IconProps> | undefined {
	if (!isValidElement<IconProps>(row) || depth > MAX_ROW_DEPTH) return;

	const children = Children.toArray(row.props.children);
	let changed = false;
	const kept = children.flatMap((child) => {
		if (carriesIcon(child, icons)) {
			changed = true;

			return [];
		}

		const pruned = pruneRow(child, icons, depth + 1);

		changed ||= pruned !== undefined;

		return [pruned ?? child];
	});

	return changed ? cloneElement(row, undefined, ...kept) : undefined;
}

/**
 * @description Removes the buttons that draw one of the given icons, such as a call button's `PhoneCallIcon`, from a row or the rows nested inside it.
 * Matching by icon keeps it working in every language.
 * @param row The rendered row of buttons, or a wrapper holding it.
 * @param icons The icon component names whose buttons to remove.
 * @returns A copy without those buttons, or `undefined` when there was none to remove.
 */
export function withoutIconButtons(
	row: ReactNode,
	icons: Set<string>,
): ReactElement<IconProps> | undefined {
	if (!icons.size) return;

	return pruneRow(row, icons, 0);
}

export default withoutIconButtons;
