import { createFileRoute } from '@tanstack/react-router';

import noteCrashReport from '~/endpoints/note-crash-report';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/crash-reports/$id/note')({
	server: {
		handlers: {
			POST: serve(noteCrashReport),
		},
	},
});
