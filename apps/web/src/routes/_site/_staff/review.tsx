import { reviewQueueQuerySchema, type ReviewQueueQuery } from '@unbound-app/contracts/review';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { reviewQueueQuery } from '~/queries/review/review';
import { schemaValidator, type Validator } from '~/lib/schema-validator';
import ReviewPage from '~/components/staff/review-page';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import { hasPermission } from '~/lib/auth/access';

// Annotated, or the search type loops through the page that reads it back and collapses to `{}`.
const validateSearch: Validator<ReviewQueueQuery> = schemaValidator(reviewQueueQuerySchema);

export const Route = createFileRoute('/_site/_staff/review')({
	head: () => ({ meta: [{ title: 'Unbound | Review' }] }),
	validateSearch,
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.review.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, cause }) => {
		// Switching the kind filter keeps the old queue up while the page fetches the new one.
		if (cause === 'stay') return;

		await context.queryClient.ensureQueryData(reviewQueueQuery(deps));
	},
	component: ReviewPage,
});
