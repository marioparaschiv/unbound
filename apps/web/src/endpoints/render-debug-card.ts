import {
	debugCardRequestSchema,
	debugCardResponseSchema,
} from '@unbound-app/contracts/debug-cards';
import { Type } from '@unbound-app/contracts/schema';

import { renderDebugCard } from '~/lib/debug-card/render';
import endpoint from '~/lib/api/endpoint';

const renderDebugCardEndpoint = endpoint(
	{ body: debugCardRequestSchema, query: Type.Undefined(), response: debugCardResponseSchema },
	async ({ ctx, body }) => renderDebugCard(body, ctx.now()),
	{ rateLimit: { bucket: 'debug-cards', budget: 'DEBUG_CARDS' } },
);

export default renderDebugCardEndpoint;
