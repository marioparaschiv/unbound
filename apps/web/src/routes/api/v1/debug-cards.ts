import { createFileRoute } from '@tanstack/react-router';

import renderDebugCard from '~/endpoints/render-debug-card';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/debug-cards')({
	server: {
		handlers: {
			POST: serve(renderDebugCard),
		},
	},
});
