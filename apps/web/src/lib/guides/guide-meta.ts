import type { Static } from '@unbound-app/contracts/schema';
import { Type } from '@unbound-app/contracts/schema';

import { GUIDE_ICON_NAMES } from './guide-icon-names';

/** A guide's frontmatter: the title and description its page header and search show, and its sidebar icon. */
export const guideFrontmatterSchema = Type.Object({
	title: Type.String({ minLength: 1 }),
	description: Type.String({ minLength: 1 }),
	icon: Type.Optional(Type.Enum(GUIDE_ICON_NAMES)),
});

export type GuideFrontmatter = Static<typeof guideFrontmatterSchema>;

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
