import type { AuthClientError } from '~/lib/auth/error-message';
import getAuthErrorMessage from '~/lib/auth/error-message';

/** A Better Auth client call's result: data on success, an error otherwise. */
export type AuthResult<T> = {
	data: T | null;
	error: AuthClientError | null;
};

/**
 * @description Turns a Better Auth client result into its data, throwing its message on failure, as a query or mutation expects.
 * @template T The call's data.
 * @param result The call's `{ data, error }` result.
 * @returns The data.
 */
function unwrapAuthResult<T>(result: AuthResult<T>): T {
	if (result.error) {
		throw new Error(getAuthErrorMessage(result.error));
	}

	if (result.data === null) {
		throw new Error('The server sent no data.');
	}

	return result.data;
}

export default unwrapAuthResult;
