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

/** The Discord OAuth request the client opens Discord's in-app authorize screen with. */
export const accountOAuthConfigSchema = z.object({
	clientId: z.string().check(z.minLength(1)),
	redirectUri: z.url(),
	scopes: z.array(z.string()),
});

export const accountSignInRequestSchema = z.object({
	code: z.string().check(z.minLength(1), z.maxLength(512)),
});

/** `token` is a session token, sent back as `Authorization: Bearer <token>`. */
export const accountSignInResponseSchema = z.object({
	token: z.string().check(z.minLength(1)),
	user: callerSchema,
});

export type UserSummary = z.infer<typeof userSummarySchema>;
export type Caller = z.infer<typeof callerSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type AccountOAuthConfig = z.infer<typeof accountOAuthConfigSchema>;
export type AccountSignInRequest = z.infer<typeof accountSignInRequestSchema>;
export type AccountSignInResponse = z.infer<typeof accountSignInResponseSchema>;

export default {
	userSummarySchema,
	callerSchema,
	meResponseSchema,
	accountOAuthConfigSchema,
	accountSignInRequestSchema,
	accountSignInResponseSchema,
};
