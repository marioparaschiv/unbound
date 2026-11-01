import { createFileRoute } from '@tanstack/react-router';

import uploadBadgeImage from '~/endpoints/upload-badge-image';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/me/badges/images')({
	server: {
		handlers: {
			POST: serve(uploadBadgeImage),
		},
	},
});
