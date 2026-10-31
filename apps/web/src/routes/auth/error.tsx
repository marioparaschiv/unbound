import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { z } from 'zod/mini';

import type { AuthErrorKind } from '~/lib/auth/auth-errors';
import { getAuthErrorKind } from '~/lib/auth/auth-errors';
import StatusPage from '~/components/status-page';
import { Button } from '~/components/ui/button';

type ErrorCopy = {
	title: string;
	description: string;
};

type RetryButtonProps = {
	seconds: number;
};

const SUPPORT_URL = 'https://discord.gg/rMdzhWUaGT';

const COPY: Record<AuthErrorKind, ErrorCopy> = {
	'rate-limited': {
		title: 'Too Many Attempts',
		description:
			'You tried to sign in too many times in a short period. Wait a moment, then try again.',
	},
	banned: {
		title: 'Account Suspended',
		description:
			'This account has been suspended from Unbound. If you believe this is a mistake, contact us on Discord.',
	},
	denied: {
		title: 'Sign-in Not Completed',
		description:
			'Discord did not confirm your identity. Make sure you approve the request and use the account you signed up with.',
	},
	expired: {
		title: 'Sign-in Session Expired',
		description:
			'Your sign-in took too long or was opened in another tab. Start again to continue.',
	},
	unknown: {
		title: 'Something Went Wrong',
		description:
			'We could not sign you in. Try again, and reach out on Discord if it keeps happening.',
	},
};

const errorSearchSchema = z.object({
	// Better Auth only forwards codes matching this pattern; anything else is not worth echoing back.
	error: z.catch(z.optional(z.string().check(z.regex(/^[\w-]{1,64}$/))), undefined),
	retry_after: z.catch(z.optional(z.coerce.number().check(z.int(), z.minimum(0))), undefined),
});

function RetryButton({ seconds }: RetryButtonProps) {
	const [remaining, setRemaining] = useState(seconds);

	useEffect(() => {
		if (remaining <= 0) return;

		const timeout = setTimeout(() => setRemaining((value) => value - 1), 1000);

		return () => clearTimeout(timeout);
	}, [remaining]);

	if (remaining > 0) {
		return (
			<Button size='lg' className='w-full' disabled>
				Try Again in {remaining}s
			</Button>
		);
	}

	return (
		<Button size='lg' className='w-full' asChild>
			<Link to='/login'>Try Again</Link>
		</Button>
	);
}

function AuthErrorPage() {
	const { error, retry_after: retryAfter } = Route.useSearch();
	const kind = getAuthErrorKind(error);
	const copy = COPY[kind];

	let primary: ReactNode = (
		<Button size='lg' className='w-full' asChild>
			<Link to='/login'>Try Again</Link>
		</Button>
	);

	if (kind === 'rate-limited') {
		primary = <RetryButton seconds={retryAfter ?? 0} />;
	}

	if (kind === 'banned') {
		primary = (
			<Button size='lg' className='w-full' asChild>
				<a href={SUPPORT_URL} target='_blank' rel='noreferrer'>
					Contact Support
				</a>
			</Button>
		);
	}

	return (
		<StatusPage
			title={copy.title}
			description={copy.description}
			code={error}
			actions={
				<>
					{primary}
					<Button variant='outline' size='lg' className='w-full' asChild>
						<Link to='/'>Go Home</Link>
					</Button>
				</>
			}
		/>
	);
}

export const Route = createFileRoute('/auth/error')({
	head: () => ({ meta: [{ title: 'Unbound | Sign-in Failed' }] }),
	validateSearch: errorSearchSchema,
	component: AuthErrorPage,
});
