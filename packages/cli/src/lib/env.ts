import { MEDIA_MAX_BYTES, MEDIA_TOTAL_MAX_BYTES } from '@unbound-app/contracts/addon-page';
import { apiUrlSchema } from '@unbound-app/contracts/api';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { safeParse, Type, type StaticDecode } from './schema';

const schema = Type.Object({
	/** The origin of the Unbound web API that `ubd login` and `ubd publish` talk to. */
	UNBOUND_API_URL: apiUrlSchema,
	/** An API key for CI; when set, `ubd publish` sends it instead of the stored login. */
	UNBOUND_API_KEY: Type.Optional(Type.String({ minLength: 1 })),
	XDG_CONFIG_HOME: Type.Optional(Type.String({ minLength: 1 })),
});

// The process environment holds only strings, so each limit is a string check plus a decode to a number.
const positiveInteger = Type.Refine(
	Type.String(),
	(value: string) => Number.isInteger(Number(value)) && Number(value) > 0,
	() => 'Too small: expected number to be >0',
);

const mediaLimitsSource = Type.Object({
	/** The largest media file ADDON.md may reference, in bytes. */
	ADDON_MEDIA_MAX_BYTES: Type.Optional(positiveInteger),
	/** The most bytes all of an addon's media may take together. */
	ADDON_MEDIA_TOTAL_MAX_BYTES: Type.Optional(positiveInteger),
});

// A missing key skips its field's codec, so the store's defaults are applied as the object decodes.
const mediaLimitsSchema = Type.Decode(mediaLimitsSource, (raw) => ({
	ADDON_MEDIA_MAX_BYTES: Number(raw.ADDON_MEDIA_MAX_BYTES ?? MEDIA_MAX_BYTES),
	ADDON_MEDIA_TOTAL_MAX_BYTES: Number(raw.ADDON_MEDIA_TOTAL_MAX_BYTES ?? MEDIA_TOTAL_MAX_BYTES),
}));

/** The validated environment the account commands read. */
export type Env = StaticDecode<typeof schema>;

/** The media size limits `ubd build` enforces. */
export type MediaLimits = StaticDecode<typeof mediaLimitsSchema>;

/** Environment variables as `process.env` provides them. */
export type EnvSource = Record<string, string | undefined>;

/**
 * @description Parses the environment the account commands read, throwing a readable error when a
 * variable is invalid.
 * @param source The variables to parse.
 * @returns The validated environment.
 */
export function parseEnv(source: EnvSource = process.env): Env {
	const parsed = safeParse(schema, source);

	if (!parsed.success) {
		throw new Error(`Invalid environment:\n${parsed.error.message}`);
	}

	return parsed.data;
}

/**
 * @description Parses the media size limits, falling back to the store's defaults.
 * @param source The variables to parse.
 * @returns The per-file and per-addon limits in bytes.
 */
export function parseMediaLimits(source: EnvSource = process.env): MediaLimits {
	const parsed = safeParse(mediaLimitsSchema, source);

	if (!parsed.success) {
		throw new Error(`Invalid environment:\n${parsed.error.message}`);
	}

	return parsed.data;
}

/**
 * @description Resolves where `ubd login` stores credentials, following the XDG base directory spec.
 * @param env The validated environment.
 * @returns The absolute path of `unbound/credentials.json` in the user's config directory.
 */
export function getCredentialsPath(env: Env): string {
	const configHome = env.XDG_CONFIG_HOME ?? join(homedir(), '.config');

	return join(configHome, 'unbound', 'credentials.json');
}

export default { parseEnv, parseMediaLimits, getCredentialsPath };
