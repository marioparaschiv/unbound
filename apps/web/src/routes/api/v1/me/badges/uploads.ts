import { createFileRoute } from '@tanstack/react-router';

import createBadgeUpload from '~/endpoints/create-badge-upload';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/me/badges/uploads')({
	server: {
		handlers: {
			POST: serve(createBadgeUpload),
		},
	},
});
