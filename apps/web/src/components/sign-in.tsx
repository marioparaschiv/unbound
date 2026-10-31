import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { signInMutation } from '~/queries/account/session';
import DiscordIcon from '~/components/icons/discord';
import { Button } from '~/components/ui/button';

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
	const { mutate, isPending } = useMutation(signInMutation());

	function signIn() {
		mutate(callbackURL, { onError: (error) => toast.error(error.message) });
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
