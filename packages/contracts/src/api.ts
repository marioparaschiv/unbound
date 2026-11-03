import { Type } from './schema';

/** The origin of the Unbound web API, reduced from any http(s) URL; production when unset. */
export const apiUrlSchema = Type.Codec(
	Type.String({
		format: 'url',
		pattern: /^https?:\/\//i,
		default: 'https://unbound.rip',
	}),
)
	.Decode((url: string) => new URL(url).origin)
	.Encode((origin) => String(origin));

export default { apiUrlSchema };
