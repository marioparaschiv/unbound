import type { NativeViewSnapshotNode as Node, NativeObjectHandle } from '@unbound-app/api/native';

export type UsernameHeader = {
	label: NativeObjectHandle;
	header: NativeObjectHandle;
};

function isVisibleLabel(node: Node): boolean {
	return (
		node.className === 'DCDLabel' &&
		Boolean(node.text) &&
		node.frame.width > 0 &&
		node.frame.height > 0
	);
}

// The header row is the nearest ancestor about as tall as the name but much wider than it.
function headerFor(nodes: Node[], label: Node): NativeObjectHandle | null {
	let parent = nodes[label.parent];

	for (let depth = 0; parent && depth < 8; depth++) {
		const { frame } = parent;

		if (
			frame.height <= label.frame.height + 4 &&
			frame.width >= 120 &&
			frame.width > label.frame.width * 1.5
		) {
			return parent.view;
		}

		parent = nodes[parent.parent];
	}

	return null;
}

function mentionsUsername(text: string, username: string): boolean {
	return text.toLowerCase().includes(username.toLowerCase());
}

/**
 * @description Finds the username label and its header row in a message cell's view snapshot: the label showing the
 * account name, else one that contains it (such as "Name (@username)"), else the first label of the only header row,
 * since role tags and badges in that row are labels too and come after the name.
 * @param nodes The cell's view snapshot, in drawing order.
 * @param username The author's account name.
 * @returns The label and header, or `null` when the cell has no header row or several.
 */
export function findUsernameHeader(nodes: Node[], username: string): UsernameHeader | null {
	const candidates = nodes.flatMap((node) => {
		const header = isVisibleLabel(node) ? headerFor(nodes, node) : null;

		return header ? [{ node, header }] : [];
	});
	const chosen =
		candidates.find(({ node }) => node.text === username) ??
		(username
			? candidates.find(({ node }) => mentionsUsername(node.text ?? '', username))
			: undefined) ??
		(candidates.every(({ header }) => header === candidates[0]?.header)
			? candidates[0]
			: undefined);

	return chosen ? { label: chosen.node.view, header: chosen.header } : null;
}

export default { findUsernameHeader };
