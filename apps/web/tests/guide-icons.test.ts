import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { GUIDE_ICON_NAMES } from '~/lib/guides/guide-icon-names';

const DOCS = join(import.meta.dir, '../../../docs');

// Frontmatter `icon:` and the `icon=` prop of Card, Accordion, Step and Icon.
const ICON_USE = /\bicon[=:] ?['"]([^'"]+)['"]/g;

describe('guide icons', () => {
	test('every icon a guide names is in the micro bold set the site renders', async () => {
		const known = new Set<string>(GUIDE_ICON_NAMES);
		const unknown: string[] = [];

		for (const file of new Bun.Glob('{user,developer}/**/*.mdx').scanSync(DOCS)) {
			const source = await Bun.file(join(DOCS, file)).text();

			for (const [, name] of source.matchAll(ICON_USE)) {
				if (name && !known.has(name)) {
					unknown.push(`${file}: ${name}`);
				}
			}
		}

		expect(unknown).toEqual([]);
	});
});
