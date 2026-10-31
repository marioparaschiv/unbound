import { IconCopies, IconLockPassword, IconPlus, IconTrash } from 'nucleo-micro-bold';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { toast } from 'sonner';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '~/components/ui/dialog';
import {
	accountOverviewQuery,
	createApiKeyMutation,
	deleteApiKeyMutation,
} from '~/queries/account/account';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import ConfirmDialog from '~/components/confirm-dialog';
import type { AccountApiKey } from '~/lib/auth/account';
import Separator from '~/components/ui/separator';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';

type ApiKeyRowProps = {
	apiKey: AccountApiKey;
};

type CreatedKeyDialogProps = {
	secret: string | null;
	onClose: () => void;
};

// Fixed to UTC so the server render and the hydrated page print the same day.
const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

function describeKey(apiKey: AccountApiKey): string {
	const created = `Created ${DATE_FORMAT.format(apiKey.createdAt)}`;
	const used = apiKey.lastRequest
		? `last used ${DATE_FORMAT.format(apiKey.lastRequest)}`
		: 'never used';

	return `${created}, ${used}`;
}

function ApiKeyRow({ apiKey }: ApiKeyRowProps) {
	const { mutate, isPending } = useMutation(deleteApiKeyMutation());
	const label = apiKey.name ?? 'Unnamed key';

	function revoke() {
		mutate(apiKey.id, {
			onSuccess: () => toast.success(`Revoked ${label}`),
			onError: (error) => toast.error(error.message),
		});
	}

	return (
		<div className='flex justify-between items-center gap-4'>
			<div className='flex items-center gap-3 min-w-0'>
				<IconLockPassword size={16} className='shrink-0 text-muted-foreground' />
				<div className='flex flex-col min-w-0'>
					<Text variant='text-sm' className='font-medium truncate'>
						{label}
						{apiKey.start ? (
							<span className='ml-2 font-mono text-muted-foreground'>
								{apiKey.start}…
							</span>
						) : null}
					</Text>
					<Text variant='text-xs' color='muted'>
						{describeKey(apiKey)}
					</Text>
				</div>
			</div>

			<ConfirmDialog
				trigger={
					<Button variant='outline' size='sm' className='gap-2' disabled={isPending}>
						<IconTrash size={14} />
						Revoke
					</Button>
				}
				title={`Revoke ${label}?`}
				description='Anything still using this key, such as a CI workflow running ubd publish, stops working immediately. This cannot be undone.'
				confirmLabel='Revoke Key'
				onConfirm={revoke}
			/>
		</div>
	);
}

function CreatedKeyDialog({ secret, onClose }: CreatedKeyDialogProps) {
	async function copy() {
		if (!secret) return;

		try {
			await navigator.clipboard.writeText(secret);
			toast.success('Copied to clipboard');
		} catch (error) {
			toast.error(`Failed to copy the key, copy it by hand: ${String(error)}`);
		}
	}

	function handleOpenChange(open: boolean) {
		if (open) return;

		onClose();
	}

	return (
		<Dialog open={secret !== null} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Your new API key</DialogTitle>
					<DialogDescription>
						Copy it now: it is shown only once. Send it in the x-api-key header, or set
						it as UNBOUND_API_KEY for ubd publish in CI.
					</DialogDescription>
				</DialogHeader>
				<Input readOnly value={secret ?? ''} className='font-mono' />
				<DialogFooter>
					<Button variant='outline' onClick={copy}>
						<IconCopies size={24} />
						Copy
					</Button>
					<Button onClick={onClose}>Done</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ApiKeysCard() {
	const { apiKeys } = useSuspenseQuery(accountOverviewQuery()).data;
	const [secret, setSecret] = useState<string | null>(null);
	const { mutateAsync, isPending } = useMutation(createApiKeyMutation());
	const form = useForm({
		defaultValues: { name: '' },
		onSubmit: async ({ value, formApi }) => {
			try {
				const created = await mutateAsync(value.name.trim());

				formApi.reset();
				setSecret(created.key);
			} catch (error) {
				toast.error(error instanceof Error ? error.message : String(error));
			}
		},
	});

	return (
		<Card className='gap-4'>
			<CardHeader>
				<CardTitle>API Keys</CardTitle>
				<Text variant='text-sm' color='muted' className='mb-2'>
					Keys let CI publish addons with ubd publish on your behalf.
				</Text>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
					className='flex gap-2'
				>
					<form.Field name='name'>
						{(field) => (
							<>
								<Input
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									placeholder='Key name, e.g. GitHub Actions'
									aria-label='Key name'
									disabled={isPending}
									required
								/>
								<Button
									type='submit'
									disabled={isPending || !field.state.value.trim()}
								>
									<IconPlus size={24} />
									Create
								</Button>
							</>
						)}
					</form.Field>
				</form>

				{apiKeys.length === 0 ? (
					<Empty className='p-6 md:p-6'>
						<EmptyHeader>
							<EmptyMedia variant='icon'>
								<IconLockPassword size={24} />
							</EmptyMedia>
							<EmptyTitle>No API keys</EmptyTitle>
							<EmptyDescription>Create one to publish from CI.</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					apiKeys.map((apiKey) => (
						<div key={apiKey.id} className='flex flex-col gap-3'>
							<Separator />
							<ApiKeyRow apiKey={apiKey} />
						</div>
					))
				)}
			</CardContent>

			<CreatedKeyDialog secret={secret} onClose={() => setSecret(null)} />
		</Card>
	);
}

export default ApiKeysCard;
