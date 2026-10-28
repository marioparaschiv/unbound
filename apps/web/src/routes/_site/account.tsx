import { createFileRoute, redirect } from '@tanstack/react-router';

import LinkedAccountsCard from '~/components/account/linked-accounts-card';
import SponsorshipCard from '~/components/account/sponsorship-card';
import ApiKeysCard from '~/components/account/api-keys-card';
import ProfileCard from '~/components/account/profile-card';
import PerksCard from '~/components/account/perks-card';
import { getAccountOverview } from '~/lib/auth/account';
import PageHeader from '~/components/page-header';

function AccountPage() {
	const { user } = Route.useRouteContext();
	const { accounts, apiKeys, sponsor } = Route.useLoaderData();

	return (
		<div className='flex flex-col gap-6 page-frame'>
			<PageHeader
				title='Account Settings'
				description='Manage your account information, linked accounts, sponsorship and API keys.'
			/>

			<ProfileCard user={user} />
			<LinkedAccountsCard accounts={accounts} />
			<SponsorshipCard sponsor={sponsor} />
			<PerksCard sponsor={sponsor} />
			<ApiKeysCard apiKeys={apiKeys} />
		</div>
	);
}

export const Route = createFileRoute('/_site/account')({
	head: () => ({ meta: [{ title: 'Unbound | Account' }] }),
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: '/login' });
		}

		return { user: context.session.user };
	},
	loader: () => getAccountOverview(),
	component: AccountPage,
});
