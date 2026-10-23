import { createFileRoute } from '@tanstack/react-router';

import deleteSync from '~/endpoints/delete-sync';
import getSync from '~/endpoints/get-sync';
import putSync from '~/endpoints/put-sync';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/sync')({
	server: {
		handlers: {
			GET: serve(getSync),
			PUT: serve(putSync),
			DELETE: serve(deleteSync),
		},
	},
});
