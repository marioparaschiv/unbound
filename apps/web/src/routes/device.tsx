import { IconCircleCheck, IconCircleX, IconDeviceDesktop } from '@tabler/icons-react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { z } from 'zod';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import getAuthErrorMessage from '~/lib/auth/error-message';
import type { SessionUser } from '~/lib/auth/session';
import { Button } from '~/components/ui/button';
import Logo from '~/components/icons/logo';
import authClient from '~/lib/auth/client';
import SignIn from '~/components/sign-in';
import Input from '~/components/ui/input';

type Step = 'enter' | 'confirm' | 'approved' | 'denied';

type DeviceApprovalProps = {
	user: SessionUser;
	initialCode: string;
};

const deviceSearchSchema = z.object({
	user_code: z.string().optional(),
});

function DeviceApproval({ user, initialCode }: DeviceApprovalProps) {
	const [code, setCode] = useState(initialCode);
	const [step, setStep] = useState<Step>('enter');
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	// Looking the code up while signed in claims it for this account, which approval requires.
	function verify(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		startTransition(async () => {
			const result = await authClient.device({ query: { user_code: code } });

			if (result.error) {
				setError(getAuthErrorMessage(result.error));

				return;
			}

			setError(null);
			setStep('confirm');
		});
	}

	function decide(approve: boolean) {
		startTransition(async () => {
			const result = approve
				? await authClient.device.approve({ userCode: code })
				: await authClient.device.deny({ userCode: code });

			if (result.error) {
				setError(getAuthErrorMessage(result.error));

				return;
			}

			setError(null);
			setStep(approve ? 'approved' : 'denied');
		});
	}

	if (step === 'approved' || step === 'denied') {
		const approved = step === 'approved';

		return (
			<Card className='w-full'>
				<CardHeader className='justify-items-center text-center'>
					{approved ? (
						<IconCircleCheck className='size-10 text-foreground' />
					) : (
						<IconCircleX className='size-10 text-destructive' />
					)}
					<CardTitle>{approved ? 'Device approved' : 'Device denied'}</CardTitle>
					<CardDescription>
						{approved
							? 'You can return to your terminal.'
							: 'The device was not given access to your account.'}
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card className='w-full'>
			<CardHeader>
				<CardTitle>Authorize a device</CardTitle>
				<CardDescription>
					{step === 'enter'
						? 'Enter the code shown in your terminal.'
						: `Allow the device using code ${code} to act as ${user.name}?`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{step === 'enter' ? (
					<form onSubmit={verify} className='flex flex-col gap-4'>
						<Field data-invalid={error ? true : undefined}>
							<FieldLabel htmlFor='user-code'>Device code</FieldLabel>
							<Input
								id='user-code'
								value={code}
								onChange={(event) => setCode(event.target.value)}
								className='font-mono uppercase tracking-widest'
								autoComplete='off'
								aria-invalid={error ? true : undefined}
								required
							/>
							<FieldDescription>Signed in as {user.name}.</FieldDescription>
							<FieldError>{error}</FieldError>
						</Field>
						<Button type='submit' disabled={isPending}>
							Continue
						</Button>
					</form>
				) : (
					<div className='flex flex-col gap-4'>
						<div className='flex items-center gap-3 rounded-control border bg-accent/30 p-4'>
							<IconDeviceDesktop className='size-5 shrink-0 text-muted-foreground' />
							<span className='font-mono text-sm tracking-widest'>{code}</span>
						</div>
						<FieldError>{error}</FieldError>
						<div className='flex gap-2'>
							<Button
								variant='outline'
								className='flex-1'
								disabled={isPending}
								onClick={() => decide(false)}
							>
								Deny
							</Button>
							<Button
								className='flex-1'
								disabled={isPending}
								onClick={() => decide(true)}
							>
								Approve
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function DevicePage() {
	const search = Route.useSearch();
	const session = Route.useRouteContext({ select: (context) => context.session });
	const initialCode = search.user_code ?? '';

	return (
		<div className='flex flex-col items-center justify-center flex-1 dotted-bg px-4'>
			<div className='flex flex-col items-center gap-8 w-full max-w-sm'>
				<Link to='/' className='transition-transform hover:scale-110 duration-300'>
					<Logo className='size-20 text-foreground' />
				</Link>
				{session ? (
					<DeviceApproval user={session.user} initialCode={initialCode} />
				) : (
					<SignIn
						title='Authorize a device'
						description='Sign in to approve the device asking for access to your account.'
						callbackURL={`/device?user_code=${encodeURIComponent(initialCode)}`}
					/>
				)}
			</div>
		</div>
	);
}

export const Route = createFileRoute('/device')({
	head: () => ({ meta: [{ title: 'Unbound | Authorize a device' }] }),
	validateSearch: deviceSearchSchema,
	component: DevicePage,
});
