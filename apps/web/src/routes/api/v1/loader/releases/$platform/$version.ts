import { createFileRoute } from '@tanstack/react-router';

import withdrawLoaderRelease from '~/endpoints/withdraw-loader-release';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/loader/releases/$platform/$version')({
	server: {
		handlers: {
			DELETE: serve(withdrawLoaderRelease),
		},
	},
});
