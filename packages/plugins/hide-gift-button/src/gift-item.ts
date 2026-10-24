import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

type ParentProps = {
	children?: ReactNode;
};

type TransitionItemProps = {
	renderItem?: () => ReactNode;
};

type NamedComponent = {
	displayName?: string;
};

function isGiftItem(child: ReactNode): boolean {
	if (!isValidElement<TransitionItemProps>(child)) return false;

	const { type } = child;
	const name =
		typeof type === 'string' ? type : ((type as NamedComponent).displayName ?? type.name);

	return name === 'TransitionItem' && typeof child.props.renderItem === 'function';
}

/**
 * @description Removes the animated slot that holds the gift button from the composer's right-hand actions.
 * @param element The rendered right-hand actions.
 * @returns A copy without the gift slot, or `undefined` when there was none to remove.
 */
export function withoutGiftItem(
	element: ReactElement<ParentProps>,
): ReactElement<ParentProps> | undefined {
	const children = Children.toArray(element.props.children);
	const kept = children.filter((child) => !isGiftItem(child));

	if (kept.length === children.length) return;

	return cloneElement(element, undefined, ...kept);
}

export default withoutGiftItem;
