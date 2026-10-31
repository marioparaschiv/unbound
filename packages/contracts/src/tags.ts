import { z } from './zod';

/** How many tags an author may file one submission under. */
export const MAX_SUBMISSION_TAGS = 5;

/** A tag's id: a lowercase slug. */
export const tagIdSchema = z.string().check(z.regex(/^[a-z\d]+(?:-[a-z\d]+)*$/), z.maxLength(64));

/** A tag as pills and menus show it. */
export const tagSchema = z.object({
	id: tagIdSchema,
	label: z.string(),
	/** A CSS color for the tag's dot. */
	color: z.string(),
});

/** The tags an author files a submission under, by id. */
export const submissionTagsSchema = z.array(tagIdSchema).check(
	z.maxLength(MAX_SUBMISSION_TAGS),
	z.refine((tags) => new Set(tags).size === tags.length, 'Tag ids must be unique.'),
);

export type TagId = z.infer<typeof tagIdSchema>;
export type Tag = z.infer<typeof tagSchema>;

export default { MAX_SUBMISSION_TAGS, tagIdSchema, tagSchema, submissionTagsSchema };
