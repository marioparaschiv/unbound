import { getElementName, isElementNode, type ElementNode } from '../react/find-element';

function isRow(value: unknown): value is ElementNode {
	if (!isElementNode(value) || !isElementNode(value.props) || Array.isArray(value.props)) {
		return false;
	}

	return typeof value.props.label === 'string' && typeof value.props.onPress === 'function';
}

/**
 * @description Recognizes the group that holds an action sheet's rows, including the anonymous group newer Discord builds render.
 * @param value Any node from an action sheet's render result.
 * @returns `true` for an `ActionSheetRowGroup`, or an unnamed element whose children are all labelled rows.
 */
export function isActionSheetRowGroup(value: unknown): value is ElementNode {
	if (!isElementNode(value) || Array.isArray(value)) {
		return false;
	}

	if (getElementName(value) === 'ActionSheetRowGroup') {
		return true;
	}

	const children = value.props?.children;

	if (typeof value.props?.hasIcons !== 'boolean' || !Array.isArray(children)) {
		return false;
	}

	return children.length > 0 && children.every(isRow);
}

export default { isActionSheetRowGroup };
