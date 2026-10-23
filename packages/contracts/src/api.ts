import { z } from './zod';

/** The origin of the Unbound web API, reduced from any http(s) URL; production when unset. */
export const apiUrlSchema = z._default(
	z.pipe(
		z.url({ protocol: /^https?$/ }),
		z.transform((url: string) => new URL(url).origin),
	),
	'https://unbound.rip',
);

export default { apiUrlSchema };
