import type { ListRepositoryAddonsResponse, RepositoryAddon } from '@unbound-app/contracts/source';
import { IconEye, IconRefresh } from 'nucleo-micro-bold';
import { useForm } from '@tanstack/react-form';
import { useId } from 'react';

import {
	repositoryAddonsQuery,
	submissionPreviewQuery,
	toPreviewRequest,
} from '~/queries/submissions/submissions';
import { Field, FieldDescription, FieldLabel } from '~/components/ui/field';
import type { PreviewRequest } from '~/queries/submissions/submissions';
import usePrefetchIntent from '~/queries/use-prefetch-intent';
import { getTreeUrl, shortSha } from '~/lib/github-urls';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type AddonPickerProps = {
	listing: ListRepositoryAddonsResponse;
	lockedAddonId?: string;
	selected: string | null;
	disabled: boolean;
	onRefChange: (ref: string) => void;
	onPick: (addon: RepositoryAddon) => void;
};

type AddonOptionProps = {
	addon: RepositoryAddon;
	/** The preview the Preview button reads, or `null` when the addon cannot be previewed. */
	request: PreviewRequest | null;
	selected: boolean;
	disabled: boolean;
	onPick: () => void;
};

function AddonOption({ addon, request, selected, disabled, onPick }: AddonOptionProps) {
	const prefetch = usePrefetchIntent(submissionPreviewQuery(request));

	return (
		<li className='flex flex-wrap items-start gap-3 py-3'>
			<div className='flex flex-col flex-1 gap-1 min-w-48'>
				<div className='flex flex-wrap items-center gap-2'>
					<Text as='span' variant='text-sm' className='font-medium'>
						{addon.name ?? addon.id}
					</Text>
					<Text as='span' variant='text-xs' color='muted' className='font-mono'>
						{addon.id} {addon.version ?? ''}
					</Text>
					<Tag className='uppercase'>{addon.kind}</Tag>
				</div>
				<Text variant='text-xs' color='muted' className='font-mono'>
					{addon.bundle}
				</Text>
				{addon.issues.map((issue) => (
					<Text key={issue} variant='text-xs' color='destructive'>
						{issue}
					</Text>
				))}
			</div>
			<Button
				type='button'
				size='sm'
				variant={selected ? 'default' : 'outline'}
				disabled={disabled}
				onClick={onPick}
				{...prefetch}
			>
				<IconEye size={24} />
				Preview
			</Button>
		</li>
	);
}

function AddonPicker({
	listing,
	lockedAddonId,
	selected,
	disabled,
	onRefChange,
	onPick,
}: AddonPickerProps) {
	const id = useId();
	const release = listing.details.latestRelease?.tag;
	const releaseSource =
		release && release !== listing.ref
			? { repository: listing.repository, ref: release }
			: null;
	const prefetchRelease = usePrefetchIntent(repositoryAddonsQuery(releaseSource));
	const form = useForm({
		defaultValues: { ref: listing.ref },
		onSubmit: ({ value }) => onRefChange(value.ref),
	});

	return (
		<div className='flex flex-col gap-3'>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<Field>
					<FieldLabel htmlFor={`${id}-ref`}>Branch, tag or commit</FieldLabel>
					<div className='flex gap-2'>
						<form.Field name='ref'>
							{(field) => (
								<Input
									id={`${id}-ref`}
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									disabled={disabled}
									required
								/>
							)}
						</form.Field>
						<Button type='submit' variant='outline' disabled={disabled}>
							<IconRefresh size={24} />
							Read
						</Button>
					</div>
					<FieldDescription>
						Read at{' '}
						<a
							href={getTreeUrl({ ...listing, path: '' })}
							target='_blank'
							rel='noopener noreferrer'
							className='font-mono underline-offset-4 hover:underline'
						>
							{shortSha(listing.commitSha)}
						</a>
						.
						{releaseSource ? (
							<>
								{' '}
								Latest release:{' '}
								<Button
									type='button'
									variant='link'
									className='px-0 h-auto'
									disabled={disabled}
									onClick={() => {
										form.setFieldValue('ref', releaseSource.ref);
										void form.handleSubmit();
									}}
									{...prefetchRelease}
								>
									{releaseSource.ref}
								</Button>
							</>
						) : null}
					</FieldDescription>
				</Field>
			</form>

			{listing.addons.length === 0 ? (
				<Text variant='text-sm' color='muted'>
					No addons in {listing.repository} at this commit.
				</Text>
			) : (
				<ul className='flex flex-col divide-y'>
					{listing.addons.map((addon) => (
						<AddonOption
							key={addon.path}
							addon={addon}
							request={toPreviewRequest(listing, addon.path)}
							selected={selected === addon.path}
							disabled={
								disabled ||
								addon.issues.length > 0 ||
								(lockedAddonId !== undefined && addon.id !== lockedAddonId)
							}
							onPick={() => onPick(addon)}
						/>
					))}
				</ul>
			)}

			{listing.skipped.length > 0 ? (
				<div className='flex flex-col gap-1'>
					<Text variant='text-xs' color='muted'>
						Skipped
					</Text>
					{listing.skipped.map((entry) => (
						<Text key={entry.path} variant='text-xs' color='muted'>
							<a
								href={getTreeUrl({ ...listing, path: entry.path })}
								target='_blank'
								rel='noopener noreferrer'
								className='font-mono underline-offset-4 hover:underline'
							>
								{entry.path || '/'}
							</a>
							: {entry.reason}
						</Text>
					))}
				</div>
			) : null}
		</div>
	);
}

export default AddonPicker;
