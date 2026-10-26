import { z } from './zod';

/** A user as other users see them, e.g. a submitter or a maintainer. */
export const userSummarySchema = z.object({
	id: z.string().check(z.minLength(1)),
	name: z.string(),
	image: z.nullable(z.string()),
});

export const callerSchema = z.extend(userSummarySchema, {
	role: z.string(),
});

/** The authenticated caller, resolved from a session cookie, a bearer token or an API key. */
export const meResponseSchema = z.object({
	user: callerSchema,
});

export type UserSummary = z.infer<typeof userSummarySchema>;
export type Caller = z.infer<typeof callerSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

export default { userSummarySchema, callerSchema, meResponseSchema };
