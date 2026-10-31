import type { ReactNode } from 'react';

/** One node of a parsed Markdown tree; `type` names the rule that parsed it. */
export type MarkdownNode = {
	type: string;
	content?: MarkdownNode[] | string;
};

/** The parse state Discord's rules read; the `allow*` flags turn links, headings and lists on. */
export type MarkdownState = {
	key?: string | number;
	inline?: boolean;
	allowLinks?: boolean;
	allowHeading?: boolean;
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
	order: number;
	match(source: string, state: MarkdownState, previous: string): RegExpExecArray | null;
	parse(capture: RegExpExecArray, parse: MarkdownNestedParse, state: MarkdownState): TNode;
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
	reactParserFor(rules: MarkdownRules): MarkdownReactParser;
	parse: MarkdownReactParser;
	parseToAST(source?: string, inline?: boolean, state?: MarkdownState): MarkdownNode[];
};
