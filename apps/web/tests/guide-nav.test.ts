import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { GUIDE_NAV, getGuideSlugs, type GuideTab } from '~/lib/guides/guide-nav';

const DOCS = join(import.meta.dir, '../../../docs');

function listGuideFiles(tab: GuideTab): string[] {
	return [...new Bun.Glob('**/*.mdx').scanSync(join(DOCS, tab))]
		.map((file) => file.slice(0, -'.mdx'.length))
		.sort();
}

describe('guide nav', () => {
	for (const { tab } of Object.values(GUIDE_NAV)) {
		test(`lists every ${tab} guide in docs/${tab} exactly once`, () => {
			const slugs = getGuideSlugs(tab);

			expect(new Set(slugs).size).toBe(slugs.length);
			expect([...slugs].sort()).toEqual(listGuideFiles(tab));
		});
	}
});
