import { createFileRoute } from '@tanstack/react-router';

import fileCrashIssue from '~/endpoints/file-crash-issue';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/crash-reports/$id/issue')({
	server: {
		handlers: {
			POST: serve(fileCrashIssue),
		},
	},
});
