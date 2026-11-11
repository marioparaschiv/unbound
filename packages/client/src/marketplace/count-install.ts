import { createApiClient } from '@unbound-app/web/client';
import { createLogger } from '@unbound-app/logger';
import type { Api } from '@unbound-app/web/api';

import { API_URL } from '~/core/constants';

const logger = createLogger('Marketplace', 'Installs');

/**
 * @description Reports a fresh marketplace install so the store can rank addons by popularity. The request
 * carries only the addon id: no account, device or token. Runs in the background; a failure only logs.
 * @param id The installed addon's id.
 */
export function countInstall(id: string): void {
	const request = createApiClient<Api>({ baseUrl: API_URL });

	request('POST /api/v1/addons/$id/installs', { params: { id } }).catch((error) => {
		logger.warn(`Failed to count install of ${id}:`, error);
	});
}
