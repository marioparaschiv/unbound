import { createMiddleware, createStart } from '@tanstack/react-start';
import { isPostgresSafe } from '@unbound-app/contracts/text';

import { ApiError } from '~/lib/api/errors';

// Server functions bind their input as text, so input Postgres cannot store is refused before any runs.
const refuseUnstorableInput = createMiddleware({ type: 'function' }).server(({ data, next }) => {
	if (!isPostgresSafe(data)) {
		throw new ApiError(
			'invalid_request',
			'The input must not contain NUL (U+0000) or an unpaired surrogate.',
		);
	}

	return next();
});

export const startInstance = createStart(() => ({
	functionMiddleware: [refuseUnstorableInput],
}));
