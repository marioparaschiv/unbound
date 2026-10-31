import { getRequestHeaders } from '@tanstack/react-start/server';

import { requireCaller } from '~/lib/api/caller';
import type { Caller } from '~/lib/api/caller';
import app from '~/lib/app';

/**
 * @description Resolves the caller of the current server function request, failing with
 * `unauthorized` when there is none.
 * @returns The caller.
 */
function requestCaller(): Promise<Caller> {
	return requireCaller(app, getRequestHeaders());
}

export default requestCaller;
