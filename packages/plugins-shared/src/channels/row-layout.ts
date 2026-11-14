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

function hasKey(node: RenderNode | null | undefined, key: string): boolean {
	return node?.key === key;
}

/**
 * @description Finds where a text channel row shows its channel info, which a plugin's element goes beside.
 * @param result The rendered text channel row.
 * @param channelId The row's channel ID.
 * @param key The key of the element the plugin adds, which marks a row it already patched.
 * @returns The row, its content, and the info's index, or nothing for an unfamiliar or already patched row.
 */
export function findTextChannelSlot(
	result: RenderNode,
	channelId: string,
	key: string,
): TextChannelSlot | undefined {
	const row = childrenOf(result)?.find((child) => child?.props?.accessibilityRole === 'button');
	const content = childrenOf(row)?.find((child) =>
		childrenOf(child)?.some((part) => isChannelPart(part, channelId)),
	);
	const parts = childrenOf(content);

	if (!row || !content || !parts || parts.some((part) => hasKey(part, key))) return;

	return {
		row,
		content,
		parts,
		index: parts.findIndex((part) => isChannelPart(part, channelId)),
	};
}

/**
 * @description Finds the thread row button whose `channelInfo` a plugin's element joins.
 * @param result The rendered thread channel row.
 * @param channelId The thread's channel ID.
 * @param key The key of the element the plugin adds, which marks a row it already patched.
 * @returns The row and its container, or nothing for an unfamiliar or already patched row.
 */
export function findThreadChannelSlot(
	result: RenderNode,
	channelId: string,
	key: string,
): ThreadChannelSlot | undefined {
	for (const container of childrenOf(result) ?? []) {
		const row = childrenOf(container)?.find(
			(child) =>
				isChannelPart(child, channelId) && child.props?.accessibilityRole === 'button',
		);

		if (!row) {
			continue;
		}

		return hasKey(row.props?.channelInfo, key) ? undefined : { container, row };
	}
}

export default { childrenOf, findTextChannelSlot, findThreadChannelSlot };
