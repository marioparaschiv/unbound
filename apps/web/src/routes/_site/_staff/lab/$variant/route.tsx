import { Outlet, createFileRoute, notFound } from '@tanstack/react-router';

import { isLabVariantId } from '~/components/lab/lab-variant';
import LAB_VARIANTS from '~/components/lab/variants';

function LabVariantLayout() {
	const { variant } = Route.useParams();
	const { Layout } = LAB_VARIANTS[variant];

	return (
		<Layout>
			<Outlet />
		</Layout>
	);
}

export const Route = createFileRoute('/_site/_staff/lab/$variant')({
	params: {
		parse: ({ variant }) => {
			if (!isLabVariantId(variant)) {
				throw notFound();
			}

			return { variant };
		},
		stringify: ({ variant }) => ({ variant }),
	},
	component: LabVariantLayout,
});
