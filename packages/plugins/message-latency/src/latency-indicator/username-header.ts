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

/**
 * @description Finds the username label and its header row in a message cell's view snapshot.
 * @param nodes The cell's view snapshot.
 * @param username The author name the label should show.
 * @returns The label and header, or `null` when the cell has no header row.
 */
export function findUsernameHeader(nodes: Node[], username: string): UsernameHeader | null {
	const exact = nodes.find((node) => isVisibleLabel(node) && node.text === username);

	if (exact) {
		const header = headerFor(nodes, exact);

		return header ? { label: exact.view, header } : null;
	}

	// The shown name can differ from the account name (nicknames), so fall back to the only label with a header.
	let match: UsernameHeader | null = null;

	for (const node of nodes) {
		const header = isVisibleLabel(node) ? headerFor(nodes, node) : null;

		if (!header) {
			continue;
		}

		if (match) return null;

		match = { label: node.view, header };
	}

	return match;
}

export default { findUsernameHeader };
