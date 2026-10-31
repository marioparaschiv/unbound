import { Link, createFileRoute } from '@tanstack/react-router';

import Logo from '~/components/icons/logo';
import SignIn from '~/components/sign-in';

function LoginPage() {
	return (
		<div className='flex flex-col items-center justify-center flex-1 dotted-bg px-4'>
			<div className='flex flex-col items-center gap-8 w-full max-w-sm'>
				<Link to='/' className='transition-transform hover:scale-110 duration-300'>
					<Logo className='size-20' />
				</Link>
				<SignIn callbackURL='/' />
			</div>
		</div>
	);
}

export const Route = createFileRoute('/login')({
	head: () => ({ meta: [{ title: 'Unbound | Sign in' }] }),
	component: LoginPage,
});
