import {
	debugCardRequestSchema,
	debugCardResponseSchema,
} from '@unbound-app/contracts/debug-cards';
import { Type } from '@unbound-app/contracts/schema';

import { debugCardContext } from '~/lib/debug-card/context';
import { renderDebugCard } from '~/lib/debug-card/render';
import endpoint from '~/lib/api/endpoint';

const renderDebugCardEndpoint = endpoint(
	{ body: debugCardRequestSchema, query: Type.Undefined(), response: debugCardResponseSchema },
	async ({ ctx, body }) => renderDebugCard(body, ctx.now(), await debugCardContext(ctx, body)),
	{ rateLimit: { bucket: 'debug-cards', budget: 'DEBUG_CARDS' } },
);

export default renderDebugCardEndpoint;
