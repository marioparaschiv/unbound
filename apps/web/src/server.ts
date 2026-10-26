import handler, { createServerEntry } from '@tanstack/react-start/server-entry';

import { startSponsorReconciler } from '~/lib/sponsors/reconcile';
import { startProfileRefresher } from '~/lib/authors/profiles';
import { startStagingSweeper } from '~/lib/staging';
import app from '~/lib/app';

startStagingSweeper(app);
startSponsorReconciler(app);
startProfileRefresher(app);

export default createServerEntry({
	fetch: (request) => handler.fetch(request),
});
