import type { ApiErrorCode } from '@unbound-app/contracts/errors';

import { ApiRequestError } from '~/api/client';

/** A failed call as the UI explains it: the contract code to pick the copy by, and the server's own words. */
export type ApiErrorDetails = {
	/** `null` when the failure is not an API error, such as a dropped connection. */
	code: ApiErrorCode | null;
	message: string;
};

/**
 * @description Splits a failed API call into its contract code and the server's message.
 * @param error The thrown error.
 * @returns The code, or `null` for a non-API error, and the message.
 */
// UNKNOWN: it is whatever a rejected promise was rejected with.
function getApiErrorDetails(error: unknown): ApiErrorDetails {
	if (error instanceof ApiRequestError) {
		return { code: error.code, message: error.message };
	}

	return { code: null, message: error instanceof Error ? error.message : String(error) };
}

export default getApiErrorDetails;
