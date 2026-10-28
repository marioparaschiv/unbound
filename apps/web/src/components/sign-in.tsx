import { useTransition } from 'react';
import { toast } from 'sonner';

import getAuthErrorMessage from '~/lib/auth/error-message';
import DiscordIcon from '~/components/icons/discord';
import { Button } from '~/components/ui/button';
import authClient from '~/lib/auth/client';

type SignInProps = {
	/** Where Discord sends the user back to once they have signed in. */
	callbackURL: string;
	title?: string;
	description?: string;
};

function SignIn({
	callbackURL,
	title = 'Sign in to Unbound',
	description = 'Discord is used to sign in and create your account',
}: SignInProps) {
	const [isPending, startTransition] = useTransition();

	function signIn() {
		startTransition(async () => {
			const { error } = await authClient.signIn.social({ provider: 'discord', callbackURL });

			if (error) {
				toast.error(getAuthErrorMessage(error));
			}
		});
	}

	return (
		<div className='flex flex-col items-center gap-6 w-full'>
			<div className='flex flex-col items-center gap-1 text-center'>
				<h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
				<p className='text-sm text-muted-foreground'>{description}</p>
			</div>
			<Button
				variant='outline'
				size='lg'
				className='w-full gap-2'
				disabled={isPending}
				onClick={signIn}
			>
				<DiscordIcon />
				Continue with Discord
			</Button>
		</div>
	);
}

export default SignIn;
