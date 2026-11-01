import type { ReactNode } from 'react';

/** One node of a parsed Markdown tree; `type` names the rule that parsed it. */
export type MarkdownNode = {
	/** The name of the rule that parsed the node, such as `text` or `strong`. */
	type: string;
	/** The node's children, or its text for a leaf rule; absent when a rule stores its data elsewhere. */
	content?: MarkdownNode[] | string;
};

/** The parse state Discord's rules read; the `allow*` flags turn links, headings and lists on. */
export type MarkdownState = {
	/** The React key the output function sets before calling a rule's `react`. */
	key?: string | number;
	/** Whether the parser is inside inline content; inline-only rules such as `strong` match only then. */
	inline?: boolean;
	/** Renders links as links instead of plain text. */
	allowLinks?: boolean;
	/** Parses `#` headings. */
	allowHeading?: boolean;
	/** Parses `-` and `1.` lists. */
	allowList?: boolean;
};

/** Renders a node or a list of nodes, as a rule's `react` receives it. */
export type MarkdownOutput = (
	node: MarkdownNode | MarkdownNode[],
	state: MarkdownState,
) => ReactNode;

/** Parses nested Markdown, as a rule's `parse` receives it. */
export type MarkdownNestedParse = (source: string, state: MarkdownState) => MarkdownNode[];

/** A simple-markdown rule: `match` finds it at the start of the source, `parse` builds its node, `react` renders it. */
export type MarkdownRule<TNode extends MarkdownNode = MarkdownNode> = {
	/** Discord 349 ships `highlight`, `guild` and `channel` without one; the parser never calls those. */
	order?: number;
	/** Matches the rule at the start of `source`; `previous` is the text already consumed. `null` means no match. */
	match(source: string, state: MarkdownState, previous: string): RegExpExecArray | null;
	/** Builds the node from `match`'s capture; call `parse` to parse nested Markdown. */
	parse(capture: RegExpExecArray, parse: MarkdownNestedParse, state: MarkdownState): TNode;
	/** Renders the node; call `output` to render its children. */
	react?(node: TNode, output: MarkdownOutput, state: MarkdownState): ReactNode;
};

/** A rule set by rule name, the shape `reactParserFor` takes. */
export type MarkdownRules = Record<string, MarkdownRule>;

/** Renders Markdown source to React Native elements; `inline` defaults to `true`. */
export type MarkdownReactParser = (
	source?: string,
	inline?: boolean,
	state?: MarkdownState,
) => ReactNode;

/** Discord's Markdown module (`MarkupUtils`), found by `parse`, `parseToAST` and `reactParserFor`. */
export type MarkdownParserModule = {
	/** The rules Discord renders messages with. */
	defaultRules: MarkdownRules;
	/** Builds a renderer from a rule set, such as `defaultRules` plus your own rules. */
	reactParserFor(rules: MarkdownRules): MarkdownReactParser;
	/** Renders Markdown with `defaultRules`, as Discord renders message content. */
	parse: MarkdownReactParser;
	/** Parses Markdown with `defaultRules` into nodes without rendering them; `inline` defaults to `true`. */
	parseToAST(source?: string, inline?: boolean, state?: MarkdownState): MarkdownNode[];
};
