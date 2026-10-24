import { INDICATOR_KEY } from '~/constants';

export type RenderNode = {
	key?: string | null;
	props?: {
		children?: unknown;
		channel?: { id?: string };
		accessibilityRole?: string;
		channelInfo?: RenderNode | null;
	};
};

export type TextChannelSlot = {
	row: RenderNode;
	content: RenderNode;
	parts: RenderNode[];
	index: number;
};

export type ThreadChannelSlot = {
	container: RenderNode;
	row: RenderNode;
};

/**
 * @description Reads an element's children when they are an array, the shape every row slot has.
 * @param node A rendered element.
 * @returns The children, or nothing when the element has a single child or none.
 */
export function childrenOf(node: RenderNode | null | undefined): RenderNode[] | undefined {
	const children = node?.props?.children;

	return Array.isArray(children) ? children : undefined;
}

function isChannelPart(node: RenderNode | null | undefined, channelId: string): boolean {
	return node?.props?.channel?.id === channelId;
}

/**
 * @description Tells whether an element is one the plugin inserted.
 * @param node A rendered element.
 * @returns Whether the element carries the plugin's key.
 */
export function isIndicator(node: RenderNode | null | undefined): boolean {
	return node?.key === INDICATOR_KEY;
}

/**
 * @description Finds where a text channel row shows its channel info, which the indicator goes before.
 * @param result The rendered text channel row.
 * @param channelId The row's channel ID.
 * @returns The row, its content, and the info's index, or nothing for an unfamiliar or already patched row.
 */
export function findTextChannelSlot(
	result: RenderNode,
	channelId: string,
): TextChannelSlot | undefined {
	const row = childrenOf(result)?.find((child) => child?.props?.accessibilityRole === 'button');
	const content = childrenOf(row)?.find((child) =>
		childrenOf(child)?.some((part) => isChannelPart(part, channelId)),
	);
	const parts = childrenOf(content);

	if (!row || !content || !parts || parts.some(isIndicator)) return;

	return {
		row,
		content,
		parts,
		index: parts.findIndex((part) => isChannelPart(part, channelId)),
	};
}

/**
 * @description Finds the thread row button whose `channelInfo` the indicator joins.
 * @param result The rendered thread channel row.
 * @param channelId The thread's channel ID.
 * @returns The row and its container, or nothing for an unfamiliar or already patched row.
 */
export function findThreadChannelSlot(
	result: RenderNode,
	channelId: string,
): ThreadChannelSlot | undefined {
	for (const container of childrenOf(result) ?? []) {
		const row = childrenOf(container)?.find(
			(child) =>
				isChannelPart(child, channelId) && child.props?.accessibilityRole === 'button',
		);

		if (!row) {
			continue;
		}

		return isIndicator(row.props?.channelInfo) ? undefined : { container, row };
	}
}

export default { childrenOf, isIndicator, findTextChannelSlot, findThreadChannelSlot };
