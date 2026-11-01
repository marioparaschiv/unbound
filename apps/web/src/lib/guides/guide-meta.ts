import { z } from 'zod';

/** A guide's frontmatter: the title and description its page header and search show. */
export const guideFrontmatterSchema = z.object({
	title: z.string().min(1),
	description: z.string().min(1),
});

export type GuideFrontmatter = z.infer<typeof guideFrontmatterSchema>;

/** One h2 or h3 of a guide, with the id its rendered heading carries. */
export type GuideHeading = {
	depth: 2 | 3;
	text: string;
	slug: string;
};

/** What `<guide>.mdx?meta` exports: everything about a guide except its body. */
export type GuideMeta = {
	frontmatter: GuideFrontmatter;
	toc: GuideHeading[];
};
