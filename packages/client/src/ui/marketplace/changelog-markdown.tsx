import { useMemo } from 'react';

import type { StorePage } from '~/marketplace/store-page';

import PageMarkdown from './page-markdown';

type ChangelogMarkdownProps = {
	text: string;
};

/** @description A release's markdown changelog, rendered like a store page: headings, lists, bold and links. */
function ChangelogMarkdown({ text }: ChangelogMarkdownProps) {
	// A changelog has no page folder, media or icon sprite to resolve against.
	const page = useMemo<StorePage>(
		() => ({ body: text, measured: null, icons: new Map(), folder: '' }),
		[text],
	);

	return <PageMarkdown page={page} />;
}

export default ChangelogMarkdown;
