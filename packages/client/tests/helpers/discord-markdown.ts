import type {
	MarkdownNode,
	MarkdownParserModule,
	MarkdownReactParser,
	MarkdownRule,
	MarkdownRules,
	MarkdownState,
} from '@unbound-app/types/markdown';
import { createElement, type ReactNode } from 'react';

// simple-markdown's text rule: it stops before any punctuation, so `**` falls to it one character at a time.
const TEXT = /^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff]|\n\n| {2,}\n|\w+:\S|$)/;
const STRONG = /^\*\*((?:\\[\s\S]|[^\\])+?)\*\*(?!\*)/;

function never() {
	return null;
}

function plain(type: string): MarkdownRule {
	return { match: never, parse: () => ({ type }) };
}

/** Discord 349's rules that decide paragraph text: `strong` is inline-only, `text` matches in any scope. */
const discordRules: MarkdownRules = {
	highlight: plain('highlight'),
	guild: plain('guild'),
	channel: plain('channel'),
	strong: {
		order: 7,
		match: (source, state) => (state.inline ? STRONG.exec(source) : null),
		parse: ([, content = ''], parse, state) => ({
			type: 'strong',
			content: parse(content, state),
		}),
		react: ({ content = [] }, output, state) =>
			createElement(
				'strong',
				{ key: state.key },
				Array.isArray(content) ? output(content, state) : content,
			),
	},
	text: {
		order: 25,
		match: (source) => TEXT.exec(source),
		parse: ([content]) => ({ type: 'text', content }),
		react: ({ content }) => (typeof content === 'string' ? content : null),
	},
};

/**
 * @description A stand-in for simple-markdown's `reactParserFor`: rules try in order and the first match
 * wins. A rule without a finite order never runs, as on device, where it sorts after the catch-all `text`.
 * @param rules The rule set.
 * @returns The render function.
 */
export function reactParserFor(rules: MarkdownRules): MarkdownReactParser {
	const ordered = Object.values(rules)
		.filter((rule) => Number.isFinite(rule.order))
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

	function parse(source: string, state: MarkdownState): MarkdownNode[] {
		const nodes: MarkdownNode[] = [];
		let rest = source;

		while (rest) {
			let next: MarkdownNode | undefined;

			for (const rule of ordered) {
				const capture = rule.match(rest, state, '');

				if (!capture) {
					continue;
				}

				next = rule.parse(capture, parse, state);
				rest = rest.slice(capture[0].length);

				break;
			}

			if (!next) {
				throw new Error(`No rule matched ${rest}.`);
			}

			nodes.push(next);
		}

		return nodes;
	}

	function output(node: MarkdownNode | MarkdownNode[], state: MarkdownState): ReactNode {
		if (Array.isArray(node)) {
			return node.map((child, key) => output(child, { ...state, key }));
		}

		return rules[node.type]?.react?.(node, output, state);
	}

	return (source = '', inline = true, state = {}) => {
		const scoped = { ...state, inline };

		return output(parse(source, scoped), scoped);
	};
}

export const MarkdownParser: Pick<MarkdownParserModule, 'defaultRules' | 'reactParserFor'> = {
	defaultRules: discordRules,
	reactParserFor,
};
