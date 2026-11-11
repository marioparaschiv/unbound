import { syncPutRequestSchema, syncStateSchema } from '@unbound-app/contracts/sync';
import { Type } from '@unbound-app/contracts/schema';

import { saveSyncDocument } from '~/lib/sync-documents';
import { callerEndpoint } from '~/lib/api/endpoint';
import { stripSyncDocument } from '~/lib/sync';

const putSyncEndpoint = callerEndpoint(
	{ body: syncPutRequestSchema, query: Type.Undefined(), response: syncStateSchema },
	({ ctx, body, caller: { user } }) => {
		const document = stripSyncDocument(body.document, ctx.env);

		return saveSyncDocument(ctx, user.id, body.revision, document);
	},
	{
		// A client's settings are stored whole as `json` and read back whole, never queried into.
		anyJsonBody: true,
		rateLimit: { bucket: 'sync', budget: 'SYNC' },
	},
);

export default putSyncEndpoint;
