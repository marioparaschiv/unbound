import { parseDebugCardLeniently } from '@unbound-app/contracts/debug-card-lenient';
import { debugCardResponseSchema } from '@unbound-app/contracts/debug-cards';
import { Type } from '@unbound-app/contracts/schema';
import { createLogger } from '@unbound-app/logger';

import { debugCardContext } from '~/lib/debug-card/context';
import { renderDebugCard } from '~/lib/debug-card/render';
import { ApiError } from '~/lib/api/errors';
import endpoint from '~/lib/api/endpoint';

const logger = createLogger('DebugCards');

const renderDebugCardEndpoint = endpoint(
	{ body: Type.Unknown(), query: Type.Undefined(), response: debugCardResponseSchema },
	async ({ ctx, body }) => {
		const report = parseDebugCardLeniently(body);

		if (!report.success) {
			throw new ApiError(
				'invalid_request',
				report.issues.map((issue) => `${issue.message} (at ${issue.path})`).join('\n'),
			);
		}

		if (report.dropped.length) {
			logger.info(
				`Drew a debug card without fields it could not read: ${report.dropped.join(', ')}.`,
			);
		}

		return renderDebugCard(report.data, ctx.now(), await debugCardContext(ctx, report.data));
	},
	{ rateLimit: { bucket: 'debug-cards', budget: 'DEBUG_CARDS' } },
);

export default renderDebugCardEndpoint;
