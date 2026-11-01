import remarkFrontmatter from 'remark-frontmatter';
import { createProcessor } from '@mdx-js/mdx';
import type { ShikiTransformer } from 'shiki';
import { readFile } from 'node:fs/promises';
import rehypeShiki from '@shikijs/rehype';
import remarkGfm from 'remark-gfm';
import type { Plugin } from 'vite';
import mdx from '@mdx-js/rollup';

import { guideFrontmatterSchema, type GuideMeta } from '../src/lib/guides/guide-meta';
import remarkGuideHeadings, { collectGuideHeadings } from './remark-guide-headings';

const META_SUFFIX = '.mdx?meta';

// A fence's info string after the language, such as `index.ts` in ```ts index.ts, is its title.
const codeTitle: ShikiTransformer = {
	name: 'guide-code-title',
	pre(node) {
		const title = this.options.meta?.__raw?.trim();

		node.properties['data-language'] = this.options.lang;

		if (title) {
			node.properties['data-title'] = title;
		}
	},
};

function readGuideMeta(source: string, id: string): GuideMeta {
	const tree = createProcessor({ remarkPlugins: [remarkGfm, remarkFrontmatter] }).parse(source);
	const yaml = tree.children.find((node) => node.type === 'yaml');
	const frontmatter = guideFrontmatterSchema.safeParse(Bun.YAML.parse(yaml?.value ?? ''));

	if (!frontmatter.success) {
		throw new Error(`Failed to read the frontmatter of ${id}: ${frontmatter.error.message}`);
	}

	return { frontmatter: frontmatter.data, toc: collectGuideHeadings(tree) };
}

/**
 * @description Compiles `.mdx` guides at build time, highlighting code with Shiki in light and dark CSS
 * variables, and serves `<guide>.mdx?meta` as a module holding only its frontmatter and headings, so
 * the sidebar and search never pull a page's body into their chunk.
 * @returns The Vite plugins.
 */
function guideMdx(): Plugin[] {
	const meta: Plugin = {
		name: 'guide-meta',
		enforce: 'pre',
		async load(id) {
			if (!id.endsWith(META_SUFFIX)) return;

			const file = id.slice(0, -'?meta'.length);

			this.addWatchFile(file);

			return `export default ${JSON.stringify(readGuideMeta(await readFile(file, 'utf8'), file))};`;
		},
	};

	const compiler = mdx({
		remarkPlugins: [remarkGfm, remarkFrontmatter, remarkGuideHeadings],
		rehypePlugins: [
			[
				rehypeShiki,
				{
					themes: { light: 'github-light', dark: 'github-dark' },
					defaultColor: false,
					defaultLanguage: 'text',
					fallbackLanguage: 'text',
					lazy: true,
					transformers: [codeTitle],
				},
			],
		],
	});

	return [
		meta,
		{
			...compiler,
			enforce: 'pre',
			// The compiler drops the query before matching, so it would compile `?meta` modules as MDX too.
			transform(value, id) {
				return id.includes('?') ? undefined : compiler.transform(value, id);
			},
		},
	];
}

export default guideMdx;
