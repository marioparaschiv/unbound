import { syncPutRequestSchema, syncStateSchema } from '@unbound-app/contracts/sync';
import { Type } from '@unbound-app/contracts/schema';

import { saveSyncDocument } from '~/lib/sync-documents';
import { callerEndpoint } from '~/lib/api/endpoint';
import { consumeRateLimit } from '~/lib/rate-limit';
import { stripSyncDocument } from '~/lib/sync';

const putSyncEndpoint = callerEndpoint(
	{ body: syncPutRequestSchema, query: Type.Undefined(), response: syncStateSchema },
	async ({ ctx, body, caller: { user } }) => {
		await consumeRateLimit(ctx, {
			key: `api:sync:${user.id}`,
			windowSeconds: ctx.env.SYNC_RATE_LIMIT_WINDOW_SECONDS,
			max: ctx.env.SYNC_RATE_LIMIT_MAX,
		});

		const document = stripSyncDocument(body.document, ctx.env);

		return saveSyncDocument(ctx, user.id, body.revision, document);
	},
	// A client's settings are stored whole as `json` and read back whole, never queried into.
	{ anyJsonBody: true },
);

export default putSyncEndpoint;
