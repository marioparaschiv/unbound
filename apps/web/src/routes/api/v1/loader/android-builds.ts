import { createFileRoute } from '@tanstack/react-router';

import publishAndroidBuild from '~/endpoints/publish-android-build';
import listAndroidBuilds from '~/endpoints/list-android-builds';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/loader/android-builds')({
	server: {
		handlers: {
			GET: serve(listAndroidBuilds),
			POST: serve(publishAndroidBuild),
		},
	},
});
