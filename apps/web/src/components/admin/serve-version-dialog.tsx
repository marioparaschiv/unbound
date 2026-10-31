import { moderationReasonSchema } from '@unbound-app/contracts/admin';
import { useMutation } from '@tanstack/react-query';
import { IconHistory } from 'nucleo-micro-bold';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod/mini';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog';
import { serveVersionMutation } from '~/queries/admin-addons/addon-mutations';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
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

const SERVE_FORM_SCHEMA = z.object({ reason: moderationReasonSchema });

function VersionList({ label, versions }: VersionListProps) {
	if (versions.length === 0) return null;

	return (
		<Text variant='text-sm' color='muted'>
			{label}: <span className='font-mono text-foreground'>{versions.join(', ')}</span>
		</Text>
	);
}

function ServeVersionDialog({ addonId, versions, version }: ServeVersionDialogProps) {
	const [open, setOpen] = useState(false);
	const serve = useMutation(serveVersionMutation());
	const form = useForm({
		defaultValues: { reason: '' },
		validators: { onSubmit: SERVE_FORM_SCHEMA },
		onSubmit: async ({ value, formApi }) => {
			try {
				await serve.mutateAsync({
					id: addonId,
					request: { version, reason: value.reason },
				});
			} catch (error) {
				toast.error(getApiErrorMessage(error));

				return;
			}

			setOpen(false);
			formApi.reset();
			toast.success(`${addonId} now serves ${version}`);
		},
	});
	const plan = planServe(
		versions.map((entry) => ({
			version: entry.version,
			withdrawnBy: entry.withdrawal?.eventId ?? null,
		})),
		version,
	);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant='outline' size='sm'>
					<IconHistory size={24} />
					Serve this version
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
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
					<form.Field name='reason'>
						{(field) => (
							<Field data-invalid={field.state.meta.errors.length > 0}>
								<FieldLabel htmlFor={`serve-reason-${version}`}>Reason</FieldLabel>
								<Textarea
									id={`serve-reason-${version}`}
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									placeholder='Why is this version being served?'
									aria-invalid={field.state.meta.errors.length > 0}
								/>
								<FieldError errors={field.state.meta.errors} />
							</Field>
						)}
					</form.Field>
					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={() => setOpen(false)}
							disabled={serve.isPending}
						>
							Cancel
						</Button>
						<Button type='submit' disabled={serve.isPending}>
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
