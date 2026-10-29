import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { IconLink, IconLinkSlash } from 'nucleo-micro-bold';
import type { ComponentType, SVGProps } from 'react';
import { toast } from 'sonner';

import {
	accountOverviewQuery,
	linkSocialMutation,
	unlinkAccountMutation,
} from '~/queries/account/account';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { LinkedAccount } from '~/lib/auth/account';
import DiscordIcon from '~/components/icons/discord';
import GitHubIcon from '~/components/icons/github';
import Separator from '~/components/ui/separator';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';

type Provider = {
	id: 'discord' | 'github';
	name: string;
	icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type ProviderRowProps = {
	provider: Provider;
	account: LinkedAccount | undefined;
};

// Discord is the only way to sign in, so it can never be unlinked; GitHub is link-only.
const PROVIDERS: Provider[] = [
	{ id: 'discord', name: 'Discord', icon: DiscordIcon },
	{ id: 'github', name: 'GitHub', icon: GitHubIcon },
];

function ProviderRow({ provider, account }: ProviderRowProps) {
	const linkSocial = useMutation(linkSocialMutation());
	const unlinkAccount = useMutation(unlinkAccountMutation());
	const isPending = linkSocial.isPending || unlinkAccount.isPending;
	const isPrimary = provider.id === 'discord';

	function link() {
		linkSocial.mutate(provider.id, { onError: (error) => toast.error(error.message) });
	}

	function unlink(accountId: string) {
		unlinkAccount.mutate(accountId, {
			onSuccess: () => toast.success(`${provider.name} unlinked`),
			onError: (error) => toast.error(error.message),
		});
	}

	return (
		<div className='flex justify-between items-center'>
			<div className='flex items-center gap-3'>
				<provider.icon />
				<div className='flex flex-col'>
					<Text variant='text-sm' className='font-medium'>
						{provider.name}
					</Text>
					<Text variant='text-xs' color='muted'>
						{account
							? isPrimary
								? 'Connected (Primary)'
								: 'Connected'
							: 'Not connected'}
					</Text>
				</div>
			</div>

			{account ? (
				<Button
					variant='outline'
					size='sm'
					className='gap-2'
					disabled={isPending || isPrimary}
					title={
						isPrimary ? 'Discord is how you sign in to Unbound' : 'Unlink this account'
					}
					onClick={() => unlink(account.id)}
				>
					<IconLinkSlash size={14} />
					Unlink
				</Button>
			) : (
				<Button
					variant='outline'
					size='sm'
					className='gap-2'
					disabled={isPending}
					onClick={link}
				>
					<IconLink size={14} />
					Link
				</Button>
			)}
		</div>
	);
}

function LinkedAccountsCard() {
	const { accounts } = useSuspenseQuery(accountOverviewQuery()).data;

	return (
		<Card className='gap-4'>
			<CardHeader>
				<CardTitle>Linked Accounts</CardTitle>
				<Text variant='text-sm' color='muted' className='mb-2'>
					Link GitHub to publish addons from repositories you can push to.
				</Text>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				{PROVIDERS.map((provider, index) => (
					<div key={provider.id}>
						{index > 0 ? <Separator className='mb-3' /> : null}
						<ProviderRow
							provider={provider}
							account={accounts.find((account) => account.providerId === provider.id)}
						/>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

export default LinkedAccountsCard;
