import { reviewQueueQuerySchema } from '@unbound-app/contracts/review';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { reviewQueueQuery } from '~/queries/review/review';
import { STAFF_SECTIONS } from '~/lib/auth/staff-areas';
import LAB_VARIANTS from '~/components/lab/variants';
import { hasPermission } from '~/lib/auth/access';

function LabReview() {
	const { variant } = Route.useParams();
	const { ReviewPage } = LAB_VARIANTS[variant];

	return <ReviewPage />;
}

export const Route = createFileRoute('/_site/_staff/lab/$variant/review')({
	head: () => ({ meta: [{ title: 'Unbound | Review' }] }),
	validateSearch: reviewQueueQuerySchema.def.innerType,
	beforeLoad: ({ context }) => {
		if (!hasPermission(context.user.role, STAFF_SECTIONS.review.permissions)) {
			throw redirect({ to: '/' });
		}
	},
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, cause }) => {
		if (cause === 'stay') return;

		await context.queryClient.ensureQueryData(reviewQueueQuery(deps));
	},
	component: LabReview,
});
