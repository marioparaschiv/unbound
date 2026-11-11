import { useMemo } from 'react';

import type { AddonPageContent } from '~/marketplace/addon-page';

import PageMarkdown from './page-markdown';

type ChangelogMarkdownProps = {
	text: string;
};

/** @description A release's markdown changelog, rendered like a addon page: headings, lists, bold and links. */
function ChangelogMarkdown({ text }: ChangelogMarkdownProps) {
	// A changelog has no page folder, media or icon sprite to resolve against.
	const page = useMemo<AddonPageContent>(
		() => ({ body: text, measured: null, icons: new Map(), folder: '' }),
		[text],
	);

	return <PageMarkdown page={page} />;
}

export default ChangelogMarkdown;
