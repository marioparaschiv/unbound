import { editAddonRequestSchema } from '@unbound-app/contracts/admin';
import type { MaintainerEntry } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import type { AddonType } from '@unbound-app/contracts/addons';
import { useRouter } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select';
import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import type { AdminAddonView, ManifestSummary } from '~/lib/admin-addon';
import MaintainerEditor from '~/components/admin/maintainer-editor';
import getApiErrorMessage from '~/lib/api/error-message';
import { submitAddonEdit } from '~/lib/admin-functions';
import { Button } from '~/components/ui/button';
import Textarea from '~/components/ui/textarea';
import { Card } from '~/components/ui/card';
import Input from '~/components/ui/input';

type AddonEditFormProps = {
	view: AdminAddonView;
};

type FieldIssue = {
	message?: string;
};

type PinnableFieldProps = {
	id: string;
	label: string;
	/** The staff value, or `null` while the field follows the manifest. */
	value: string | null;
	/** What the field shows while it follows the manifest. */
	manifestValue: string | null;
	onChange: (value: string | null) => void;
	errors: (FieldIssue | undefined)[];
	/** The control that edits a pinned value. */
	children: ReactNode;
};

const TYPE_LABELS: Record<AddonType, string> = {
	plugin: 'Plugin',
	theme: 'Theme',
	'icon-pack': 'Icon pack',
	font: 'Font',
};

function PinnableField({
	id,
	label,
	value,
	manifestValue,
	onChange,
	errors,
	children,
}: PinnableFieldProps) {
	const pinned = value !== null;

	return (
		<Field data-invalid={errors.length > 0}>
			<div className='flex justify-between items-center gap-2'>
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
				{pinned ? (
					<Button type='button' variant='ghost' size='sm' onClick={() => onChange(null)}>
						Follow manifest
					</Button>
				) : (
					<Button
						type='button'
						variant='ghost'
						size='sm'
						onClick={() => onChange(manifestValue ?? '')}
					>
						Override
					</Button>
				)}
			</div>
			{pinned ? (
				children
			) : (
				<div
					id={id}
					className='bg-muted/50 px-3 py-2 rounded-md text-muted-foreground text-sm break-words whitespace-pre-wrap'
				>
					{manifestValue || 'Empty'}
				</div>
			)}
			<FieldDescription>
				{pinned
					? `Pinned: approvals keep this value. The manifest says "${manifestValue ?? ''}".`
					: 'Follows the served version’s manifest.'}
			</FieldDescription>
			<FieldError errors={errors} />
		</Field>
	);
}

function knownUsers(view: AdminAddonView): Record<string, UserSummary> {
	return Object.fromEntries(
		view.maintainers.map(({ id, name, image }) => [id, { id, name, image }]),
	);
}

function AddonEditForm({ view }: AddonEditFormProps) {
	const router = useRouter();
	const [users, setUsers] = useState(() => knownUsers(view));
	const manifest: ManifestSummary | null = view.manifest;
	const addonId = view.addon.id;

	const form = useForm({
		defaultValues: view.form,
		validators: { onChange: editAddonRequestSchema },
		onSubmit: async ({ value }) => {
			try {
				await submitAddonEdit({ data: { id: addonId, edit: value } });
			} catch (error) {
				toast.error(getApiErrorMessage(error));

				return;
			}

			toast.success(`Saved ${addonId}`);
			await router.invalidate();
		},
	});

	function pick(user: UserSummary) {
		setUsers((current) => ({ ...current, [user.id]: user }));
	}

	return (
		<Card className='p-5'>
			<form
				className='flex flex-col gap-6'
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field name='name'>
					{(field) => (
						<PinnableField
							id='edit-name'
							label='Name'
							value={field.state.value}
							manifestValue={manifest?.name ?? null}
							onChange={field.handleChange}
							errors={field.state.meta.errors}
						>
							<Input
								id='edit-name'
								value={field.state.value ?? ''}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
								aria-invalid={field.state.meta.errors.length > 0}
							/>
						</PinnableField>
					)}
				</form.Field>

				<form.Field name='description'>
					{(field) => (
						<PinnableField
							id='edit-description'
							label='Description'
							value={field.state.value}
							manifestValue={manifest?.description ?? null}
							onChange={field.handleChange}
							errors={field.state.meta.errors}
						>
							<Textarea
								id='edit-description'
								value={field.state.value ?? ''}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
								aria-invalid={field.state.meta.errors.length > 0}
							/>
						</PinnableField>
					)}
				</form.Field>

				<form.Field name='type'>
					{(field) => (
						<PinnableField
							id='edit-type'
							label='Type'
							value={field.state.value}
							manifestValue={manifest ? TYPE_LABELS[manifest.type] : null}
							onChange={(value) =>
								field.handleChange(
									value === null ? null : (manifest?.type ?? 'plugin'),
								)
							}
							errors={field.state.meta.errors}
						>
							<Select
								items={TYPE_LABELS}
								value={field.state.value}
								onValueChange={(type) => field.handleChange(type)}
							>
								<SelectTrigger
									id='edit-type'
									onBlur={field.handleBlur}
									aria-invalid={field.state.meta.errors.length > 0}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(TYPE_LABELS).map(([type, label]) => (
										<SelectItem key={type} value={type}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</PinnableField>
					)}
				</form.Field>

				<form.Field name='repository'>
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor='edit-repository'>Source repository</FieldLabel>
							<Input
								id='edit-repository'
								placeholder='owner/name'
								value={field.state.value ?? ''}
								onChange={(event) =>
									field.handleChange(event.target.value.trim() || null)
								}
								onBlur={field.handleBlur}
								aria-invalid={field.state.meta.errors.length > 0}
							/>
							<FieldDescription>
								The GitHub repository the addon is built from.
							</FieldDescription>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>

				<form.Field name='delisted'>
					{(field) => (
						<Field orientation='horizontal'>
							<input
								id='edit-delisted'
								type='checkbox'
								className='size-4 accent-primary'
								checked={field.state.value}
								onChange={(event) => field.handleChange(event.target.checked)}
							/>
							<FieldLabel htmlFor='edit-delisted'>
								Delisted: hidden from listings, the catalog and update checks
							</FieldLabel>
						</Field>
					)}
				</form.Field>

				<form.Field name='maintainers'>
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor='edit-maintainers'>Maintainers</FieldLabel>
							<MaintainerEditor
								id='edit-maintainers'
								members={field.state.value}
								users={users}
								onChange={(members: MaintainerEntry[]) =>
									field.handleChange(members)
								}
								onPick={pick}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>

				<form.Field name='reason'>
					{(field) => (
						<Field data-invalid={field.state.meta.errors.length > 0}>
							<FieldLabel htmlFor='edit-reason'>Reason</FieldLabel>
							<Textarea
								id='edit-reason'
								placeholder='Recorded in the moderation log with every change'
								value={field.state.value ?? ''}
								onChange={(event) =>
									field.handleChange(event.target.value || undefined)
								}
								onBlur={field.handleBlur}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>

				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting] as const}
				>
					{([canSubmit, isSubmitting]) => (
						<div className='flex justify-end gap-2'>
							<Button
								type='button'
								variant='outline'
								onClick={() => form.reset()}
								disabled={isSubmitting}
							>
								Discard changes
							</Button>
							<Button type='submit' disabled={!canSubmit || isSubmitting}>
								Save changes
							</Button>
						</div>
					)}
				</form.Subscribe>
			</form>
		</Card>
	);
}

export default AddonEditForm;
