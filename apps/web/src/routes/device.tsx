import { IconCircleCheck, IconCircleXmark, IconMonitor } from 'nucleo-micro-bold';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { z } from '@unbound-app/contracts/zod';
import { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import { decideDeviceMutation, deviceCodeQuery } from '~/queries/account/device';
import type { SessionUser } from '~/lib/auth/session';
import { Button } from '~/components/ui/button';
import Logo from '~/components/icons/logo';
import SignIn from '~/components/sign-in';
import Input from '~/components/ui/input';

type DeviceApprovalProps = {
	user: SessionUser;
	initialCode: string;
};

const deviceSearchSchema = z.object({
	user_code: z.optional(z.string()),
});

function DeviceApproval({ user, initialCode }: DeviceApprovalProps) {
	// The code last submitted; its lookup claims it for this account, which approval requires.
	const [submitted, setSubmitted] = useState<string | null>(null);
	const lookup = useQuery(deviceCodeQuery(submitted));
	const decision = useMutation(decideDeviceMutation());
	const code = submitted ?? '';
	const form = useForm({
		defaultValues: { code: initialCode },
		onSubmit: ({ value }) => {
			// Same code, same key: only a refetch asks again.
			if (value.code === submitted) {
				void lookup.refetch();

				return;
			}

			setSubmitted(value.code);
		},
	});

	if (decision.isSuccess) {
		const approved = decision.variables.approve;

		return (
			<Card className='w-full'>
				<CardHeader className='justify-items-center text-center'>
					{approved ? (
						<IconCircleCheck className='size-10 text-foreground' />
					) : (
						<IconCircleXmark className='size-10 text-destructive' />
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
					{lookup.isSuccess
						? `Allow the device using code ${code} to act as ${user.name}?`
						: 'Enter the code shown in your terminal.'}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{lookup.isSuccess ? (
					<div className='flex flex-col gap-4'>
						<div className='flex items-center gap-3 rounded-control border bg-accent/30 p-4'>
							<IconMonitor className='size-5 shrink-0 text-muted-foreground' />
							<span className='font-mono text-sm tracking-widest'>{code}</span>
						</div>
						<FieldError>{decision.error?.message}</FieldError>
						<div className='flex gap-2'>
							<Button
								variant='outline'
								className='flex-1'
								disabled={decision.isPending}
								onClick={() => decision.mutate({ userCode: code, approve: false })}
							>
								Deny
							</Button>
							<Button
								className='flex-1'
								disabled={decision.isPending}
								onClick={() => decision.mutate({ userCode: code, approve: true })}
							>
								Approve
							</Button>
						</div>
					</div>
				) : (
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void form.handleSubmit();
						}}
						className='flex flex-col gap-4'
					>
						<form.Field name='code'>
							{(field) => (
								<Field data-invalid={lookup.isError ? true : undefined}>
									<FieldLabel htmlFor='user-code'>Device code</FieldLabel>
									<Input
										id='user-code'
										value={field.state.value}
										onChange={(event) => field.handleChange(event.target.value)}
										onBlur={field.handleBlur}
										className='font-mono uppercase tracking-widest'
										autoComplete='off'
										aria-invalid={lookup.isError ? true : undefined}
										required
									/>
									<FieldDescription>Signed in as {user.name}.</FieldDescription>
									<FieldError>{lookup.error?.message}</FieldError>
								</Field>
							)}
						</form.Field>
						<Button type='submit' disabled={lookup.isFetching}>
							Continue
						</Button>
					</form>
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
