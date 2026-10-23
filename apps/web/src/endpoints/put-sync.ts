import { syncPutRequestSchema, syncStateSchema } from '@unbound-app/contracts/sync';
import { z } from 'zod';

import { saveSyncDocument } from '~/lib/sync-documents';
import { consumeRateLimit } from '~/lib/rate-limit';
import { requireCaller } from '~/lib/api/caller';
import { stripSyncDocument } from '~/lib/sync';
import endpoint from '~/lib/api/endpoint';

const putSyncEndpoint = endpoint(
	{ body: syncPutRequestSchema, query: z.undefined(), response: syncStateSchema },
	async ({ ctx, request, body }) => {
		const { user } = await requireCaller(ctx, request.headers);

		consumeRateLimit(ctx, {
			key: `api:sync:${user.id}`,
			windowSeconds: ctx.env.SYNC_RATE_LIMIT_WINDOW_SECONDS,
			max: ctx.env.SYNC_RATE_LIMIT_MAX,
		});

		const document = stripSyncDocument(body.document, ctx.env);

		return saveSyncDocument(ctx, user.id, body.revision, document);
	},
);

export default putSyncEndpoint;
