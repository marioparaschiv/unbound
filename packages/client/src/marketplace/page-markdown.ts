import type { AddonPageIconName } from '@unbound-app/contracts/addon-page-icons';

/** A Markdown list: each item is its own run of nodes. */
export type PageList = { type: 'list'; ordered: boolean; start?: number; items: PageNode[][] };

/** Content split at the icon it opens with; `icon` is absent when it opens with none. */
export type LeadingIcon = {
	icon?: AddonPageIconName;
	rest: PageNode[];
};

/** A node of a store page's Markdown, as simple-markdown's block rules and the page's icon rule parse it. */
export type PageNode =
	| PageList
	| { type: 'heading'; level: number; content: PageNode[] }
	| { type: 'paragraph' | 'blockQuote' | 'strong' | 'em' | 'u' | 'del'; content: PageNode[] }
	| { type: 'codeBlock'; lang?: string; content: string }
	| { type: 'text' | 'inlineCode'; content: string }
	| { type: 'link'; content: PageNode[]; target: string }
	| { type: 'image'; alt: string; target: string }
	| { type: 'table'; header: PageNode[][]; cells: PageNode[][][] }
	| { type: 'pageIcon'; name: AddonPageIconName }
	| { type: 'hr' | 'br' | 'newline' | 'def' };

/** A run of mixed content: inline nodes that share one line box, or one node laid out as a block. */
export type PageRun = { kind: 'inline'; nodes: PageNode[] } | { kind: 'block'; node: PageNode };

const BLOCK_TYPES = new Set<PageNode['type']>([
	'heading',
	'paragraph',
	'blockQuote',
	'list',
	'codeBlock',
	'table',
	'hr',
	'newline',
	'def',
]);

const LEADING_SPACE = /^\s+/;

function isBlank(node: PageNode): boolean {
	return node.type === 'text' && node.content.trim() === '';
}

/**
 * @description Groups mixed content, such as a list item holding text and a nested list, into runs of
 * inline nodes and the blocks between them.
 * @param nodes The content, in order.
 * @param isBlock Lays an inline node out as a block too, such as a measured image.
 * @returns The runs in order, without runs of only whitespace.
 */
export function groupRuns(nodes: PageNode[], isBlock: (node: PageNode) => boolean): PageRun[] {
	const runs: PageRun[] = [];
	let line: PageNode[] = [];

	function endLine() {
		if (line.some((node) => !isBlank(node))) {
			runs.push({ kind: 'inline', nodes: line });
		}

		line = [];
	}

	for (const node of nodes) {
		if (BLOCK_TYPES.has(node.type) || isBlock(node)) {
			endLine();
			runs.push({ kind: 'block', node });
		} else {
			line.push(node);
		}
	}

	endLine();

	return runs;
}

/**
 * @description Takes the icon a heading or list item opens with, as `## :gear: Settings` writes it,
 * so it can stand in the item's marker column.
 * @param nodes The heading's or item's content.
 * @returns The icon's name and the content after it, its leading space trimmed; without an icon, the content.
 */
export function splitLeadingIcon(nodes: PageNode[]): LeadingIcon {
	const start = nodes.findIndex((node) => !isBlank(node));
	const first = nodes[start];

	// A loose list item wraps its text in a paragraph.
	if (first?.type === 'paragraph') {
		const inner = splitLeadingIcon(first.content);
		const paragraph: PageNode = { type: 'paragraph', content: inner.rest };

		return { icon: inner.icon, rest: [paragraph, ...nodes.slice(start + 1)] };
	}

	if (first?.type !== 'pageIcon') {
		return { rest: nodes };
	}

	const rest = nodes.slice(start + 1);
	const next = rest[0];

	if (next?.type === 'text') {
		rest[0] = { type: 'text', content: next.content.replace(LEADING_SPACE, '') };
	}

	return { icon: first.name, rest };
}
