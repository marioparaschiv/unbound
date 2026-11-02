import { Type, type Static } from './schema';

/** A user as other users see them, e.g. a submitter or a maintainer. */
export const userSummarySchema = Type.Object({
	id: Type.String({ minLength: 1 }),
	name: Type.String(),
	image: Type.Union([Type.String(), Type.Null()]),
});

export const callerSchema = Type.Object({ ...userSummarySchema.properties, role: Type.String() });

/** The authenticated caller, resolved from a session cookie, a bearer token or an API key. */
export const meResponseSchema = Type.Object({
	user: callerSchema,
});

/** The Discord OAuth request the client opens Discord's in-app authorize screen with. */
export const accountOAuthConfigSchema = Type.Object({
	clientId: Type.String({ minLength: 1 }),
	redirectUri: Type.String({ format: 'url' }),
	scopes: Type.Array(Type.String()),
});

export const accountSignInRequestSchema = Type.Object({
	code: Type.String({ minLength: 1, maxLength: 512 }),
});

/** `token` is a session token, sent back as `Authorization: Bearer <token>`. */
export const accountSignInResponseSchema = Type.Object({
	token: Type.String({ minLength: 1 }),
	user: callerSchema,
});

export type UserSummary = Static<typeof userSummarySchema>;
export type Caller = Static<typeof callerSchema>;
export type MeResponse = Static<typeof meResponseSchema>;
export type AccountOAuthConfig = Static<typeof accountOAuthConfigSchema>;
export type AccountSignInRequest = Static<typeof accountSignInRequestSchema>;
export type AccountSignInResponse = Static<typeof accountSignInResponseSchema>;

export default {
	userSummarySchema,
	callerSchema,
	meResponseSchema,
	accountOAuthConfigSchema,
	accountSignInRequestSchema,
	accountSignInResponseSchema,
};
