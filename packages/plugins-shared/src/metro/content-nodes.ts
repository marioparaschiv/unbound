export type ContentNodeValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| ContentNode[]
	| ContentNodeValue[];

export type ContentNode = {
	type: string;
	content?: string | ContentNode[];
	[key: string]: ContentNodeValue;
};

export type TextSplitter = (text: string) => ContentNode[] | undefined;

const LITERAL_NODES = new Set(['inlineCode', 'codeBlock']);

function isNodeList(value: unknown): value is ContentNode[] {
	return Array.isArray(value) && value.every((node) => typeof node?.type === 'string');
}

/**
 * @description Rewrites the plain text of a native message row's content: each text node the splitter returns nodes for is
 * replaced by them, inside formatting too, never inside code.
 * @param nodes The row's content nodes.
 * @param split Returns the nodes that replace a text, or `undefined` to keep it.
 * @returns The new nodes, or the same array when nothing changed.
 */
export function mapTextNodes(nodes: ContentNode[], split: TextSplitter): ContentNode[] {
	let changed = false;
	const mapped = nodes.flatMap((node) => {
		if (node.type === 'text' && typeof node.content === 'string') {
			const replacement = split(node.content);

			if (!replacement) {
				return [node];
			}

			changed = true;

			return replacement;
		}

		if (LITERAL_NODES.has(node.type) || !isNodeList(node.content)) {
			return [node];
		}

		const content = mapTextNodes(node.content, split);

		if (content === node.content) {
			return [node];
		}

		changed = true;

		return [{ ...node, content }];
	});

	return changed ? mapped : nodes;
}

/**
 * @description Splits text around the matches of a pattern, turning each match into nodes and keeping the rest as text.
 * @param text The text.
 * @param pattern A global pattern.
 * @param toNodes Returns the nodes for a match, or `undefined` to keep it as text.
 * @returns The nodes, or `undefined` when no match became nodes.
 */
export function splitMatches(
	text: string,
	pattern: RegExp,
	toNodes: (match: RegExpMatchArray) => ContentNode[] | undefined,
): ContentNode[] | undefined {
	const nodes: ContentNode[] = [];
	let last = 0;
	let replaced = false;

	for (const match of text.matchAll(pattern)) {
		const replacement = toNodes(match);

		if (!replacement) {
			continue;
		}

		const start = match.index ?? 0;

		if (start > last) {
			nodes.push({ type: 'text', content: text.slice(last, start) });
		}

		nodes.push(...replacement);
		last = start + match[0].length;
		replaced = true;
	}

	if (!replaced) {
		return undefined;
	}

	if (last < text.length) {
		nodes.push({ type: 'text', content: text.slice(last) });
	}

	return nodes;
}

export default { mapTextNodes, splitMatches };
