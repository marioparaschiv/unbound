import { createLogger } from '@unbound-app/logger';
import { useEffect, useState } from 'react';

import { highlightCode, type HighlightedToken } from '~/lib/docs/highlight-code';
import CodeBlock from '~/components/guides/code-block';

type DocsCodeBlockProps = {
	text: string;
	language: string | undefined;
};

const logger = createLogger('Web', 'Docs');

/**
 * @description A doc comment's code, such as an `@example`, in the guides' code block: plain at first, then
 * highlighted once the grammars load.
 * @param props The code and its fence's language.
 * @returns The code block.
 */
function DocsCodeBlock({ text, language }: DocsCodeBlockProps) {
	const [lines, setLines] = useState<HighlightedToken[][]>();

	useEffect(() => {
		let current = true;

		highlightCode(text, language).then(
			(highlighted) => {
				if (current) {
					setLines(highlighted);
				}
			},
			(cause: unknown) =>
				logger.error(`Failed to highlight ${language ?? 'ts'} code:`, cause),
		);

		return () => {
			current = false;
		};
	}, [text, language]);

	return (
		<CodeBlock className='shiki' data-language={language ?? 'ts'}>
			<code>
				{lines
					? lines.map((line, index) => (
							<span key={index} className='line'>
								{line.map((token, tokenIndex) => (
									<span key={tokenIndex} style={token.style}>
										{token.content}
									</span>
								))}
								{'\n'}
							</span>
						))
					: text}
			</code>
		</CodeBlock>
	);
}

export default DocsCodeBlock;
