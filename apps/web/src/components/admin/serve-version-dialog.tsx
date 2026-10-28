import { serveVersionRequestSchema } from '@unbound-app/contracts/admin';
import { useRouter } from '@tanstack/react-router';
import { IconHistory } from 'nucleo-micro-bold';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import { submitServeVersion } from '~/lib/admin-functions';
import getApiErrorMessage from '~/lib/api/error-message';
import type { AdminVersion } from '~/lib/admin-addon';
import { Button } from '~/components/ui/button';
import Textarea from '~/components/ui/textarea';
import { planServe } from '~/lib/serve-plan';
import Text from '~/components/ui/text';

type ServeVersionDialogProps = {
	addonId: string;
	/** Every version of the addon, newest first. */
	versions: AdminVersion[];
	version: string;
};

type VersionListProps = {
	label: string;
	versions: string[];
};

function VersionList({ label, versions }: VersionListProps) {
	if (versions.length === 0) return null;

	return (
		<Text variant='text-sm' color='muted'>
			{label}: <span className='font-mono text-foreground'>{versions.join(', ')}</span>
		</Text>
	);
}

function ServeVersionDialog({ addonId, versions, version }: ServeVersionDialogProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const plan = planServe(
		versions.map((entry) => ({
			version: entry.version,
			withdrawnBy: entry.withdrawal?.eventId ?? null,
		})),
		version,
	);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const parsed = serveVersionRequestSchema.safeParse({ version, reason });

		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? 'Give a reason.');

			return;
		}

		setError(null);
		startTransition(async () => {
			try {
				await submitServeVersion({ data: { id: addonId, request: parsed.data } });
			} catch (caught) {
				toast.error(getApiErrorMessage(caught));

				return;
			}

			setOpen(false);
			setReason('');
			await router.invalidate();
			toast.success(`${addonId} now serves ${version}`);
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant='outline' size='sm'>
					<IconHistory size={24} />
					Serve this version
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={submit} className='flex flex-col gap-4'>
					<DialogHeader>
						<DialogTitle>
							Serve {addonId} <span className='font-mono'>{version}</span>?
						</DialogTitle>
						<DialogDescription>
							The catalog, listings, the public page and update checks switch to{' '}
							{version}
							{plan?.previous ? ` from ${plan.previous}` : ''}. Clients on a withdrawn
							version are offered {version}. Nothing is deleted: serving a withdrawn
							version again restores it.
						</DialogDescription>
					</DialogHeader>
					<div className='flex flex-col gap-1'>
						<VersionList label='Withdraws' versions={plan?.withdrawn ?? []} />
						<VersionList label='Restores' versions={plan?.restored ?? []} />
					</div>
					<Field data-invalid={Boolean(error)}>
						<FieldLabel htmlFor={`serve-reason-${version}`}>Reason</FieldLabel>
						<Textarea
							id={`serve-reason-${version}`}
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder='Why is this version being served?'
							aria-invalid={Boolean(error)}
						/>
						<FieldError>{error}</FieldError>
					</Field>
					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={() => setOpen(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button type='submit' disabled={isPending}>
							<IconHistory size={24} />
							Serve {version}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export default ServeVersionDialog;
