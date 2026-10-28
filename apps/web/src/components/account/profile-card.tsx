import { useNavigate, useRouter } from '@tanstack/react-router';
import { IconRectLogout } from 'nucleo-micro-bold';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import getAuthErrorMessage from '~/lib/auth/error-message';
import type { SessionUser } from '~/lib/auth/session';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import authClient from '~/lib/auth/client';
import Text from '~/components/ui/text';

type ProfileCardProps = {
	user: SessionUser;
};

function ProfileCard({ user }: ProfileCardProps) {
	const router = useRouter();
	const navigate = useNavigate();
	const [isPending, startTransition] = useTransition();

	function signOut() {
		startTransition(async () => {
			const { error } = await authClient.signOut();

			if (error) {
				toast.error(getAuthErrorMessage(error));

				return;
			}

			await navigate({ to: '/' });
			await router.invalidate();
		});
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
						<Text variant='text-sm' color='muted'>
							{user.email}
						</Text>
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
