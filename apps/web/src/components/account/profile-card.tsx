import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { IconRectLogout } from 'nucleo-micro-bold';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { accountOverviewQuery } from '~/queries/account/account';
import { signOutMutation } from '~/queries/account/session';
import type { SessionUser } from '~/lib/auth/session';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';

type ProfileCardProps = {
	user: SessionUser;
};

function ProfileCard({ user }: ProfileCardProps) {
	const router = useRouter();
	const { mutate, isPending } = useMutation(signOutMutation(router, '/'));
	const { username } = useSuspenseQuery(accountOverviewQuery()).data;

	function signOut() {
		mutate(undefined, { onError: (error) => toast.error(error.message) });
	}

	return (
		<Card className='gap-4'>
			<CardHeader>
				<CardTitle>Profile Information</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<div className='flex items-center gap-4'>
					<UserAvatar size='lg' src={user.image} name={user.name} />
					<div className='flex flex-col gap-1'>
						<Text variant='text-md' className='font-semibold'>
							{user.name}
						</Text>
						{username ? (
							<Text variant='text-sm' color='muted'>
								@{username}
							</Text>
						) : null}
					</div>
					<Button
						className='ml-auto'
						variant='destructive'
						disabled={isPending}
						onClick={signOut}
					>
						<IconRectLogout size={14} />
						Log Out
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default ProfileCard;
