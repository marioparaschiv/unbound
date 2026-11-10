import { resolvedFontSchema, resolveFontQuerySchema } from '@unbound-app/contracts/fonts';
import { Type } from '@unbound-app/contracts/schema';

import { resolveFont } from '~/lib/fonts/resolve-font';
import endpoint from '~/lib/api/endpoint';

const resolveFontEndpoint = endpoint(
	{
		body: Type.Undefined(),
		query: resolveFontQuerySchema,
		response: resolvedFontSchema,
	},
	({ query }) => resolveFont(query.input),
	{ rateLimit: { bucket: 'fonts', budget: 'FONTS' } },
);

export default resolveFontEndpoint;
