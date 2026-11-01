import { createFileRoute } from '@tanstack/react-router';

import completeBadgeUpload from '~/endpoints/complete-badge-upload';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/me/badges/uploads/$uploadId/complete')({
	server: {
		handlers: {
			POST: serve(completeBadgeUpload),
		},
	},
});
