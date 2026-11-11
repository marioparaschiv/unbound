import { Type, type StaticDecode } from './schema';

/** How many tags an author may file one submission under. */
export const MAX_SUBMISSION_TAGS = 5;

/** A tag's id: a lowercase slug. */
export const tagIdSchema = Type.String({ pattern: /^[a-z\d]+(?:-[a-z\d]+)*$/, maxLength: 64 });

/** A tag as pills and menus show it. */
export const tagSchema = Type.Object({
	id: tagIdSchema,
	label: Type.String(),
	/** A CSS color for the tag's dot. */
	color: Type.String(),
});

/** The tags an author files a submission under, by id. */
export const submissionTagsSchema = Type.Refine(
	Type.Array(tagIdSchema, { maxItems: MAX_SUBMISSION_TAGS }),
	(tags) => new Set(tags).size === tags.length,
	() => 'Tag ids must be unique.',
);

export type Tag = StaticDecode<typeof tagSchema>;

export default { MAX_SUBMISSION_TAGS, tagIdSchema, tagSchema, submissionTagsSchema };
