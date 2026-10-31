import {
	BADGE_COLORS,
	BADGE_ICONS,
	BADGE_LABEL_MAX_LENGTH,
	badgeLabelSchema,
} from '@unbound-app/contracts/sponsors';
import type { Badge, BadgeClaim } from '@unbound-app/contracts/sponsors';
import { useMutation } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { IconTrash } from 'nucleo-micro-bold';
import { toast } from 'sonner';

import UserBadge, { BADGE_COLOR_CLASSES, BADGE_ICON_COMPONENTS } from '~/components/user-badge';
import { removeBadgeMutation, saveBadgeMutation } from '~/queries/account/account';
import getApiErrorMessage from '~/lib/api/error-message';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type BadgeEditorProps = {
	claim: BadgeClaim | null;
	editable: boolean;
};

const DEFAULT_BADGE: Badge = { label: '', icon: 'heart', color: 'pink' };

function BadgeEditor({ claim, editable }: BadgeEditorProps) {
	const saveBadge = useMutation(saveBadgeMutation());
	const removeBadge = useMutation(removeBadgeMutation());
	const isPending = saveBadge.isPending || removeBadge.isPending;
	const disabled = isPending || !editable;
	const defaultValues: Badge = claim
		? { label: claim.label, icon: claim.icon, color: claim.color }
		: DEFAULT_BADGE;

	const form = useForm({
		defaultValues,
		onSubmit: async ({ value }) => {
			try {
				await saveBadge.mutateAsync(value);
				toast.success('Badge saved');
			} catch (error) {
				toast.error(getApiErrorMessage(error));
			}
		},
	});

	function remove() {
		removeBadge.mutate(undefined, {
			onSuccess: () => {
				form.reset(DEFAULT_BADGE);
				toast.success('Badge removed');
			},
			onError: (error) => toast.error(getApiErrorMessage(error)),
		});
	}

	if (claim?.revokedAt) {
		return (
			<Text variant='text-sm' color='destructive'>
				Staff removed your badge
				{claim.revokeReason ? `: ${claim.revokeReason}` : '.'} You cannot set another.
			</Text>
		);
	}

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
			className='flex flex-col gap-4'
		>
			<form.Field name='label'>
				{(field) => {
					const label = badgeLabelSchema.safeParse(field.state.value);

					return (
						<div className='flex flex-col gap-1.5'>
							<div className='flex gap-2 items-center'>
								<Input
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									maxLength={BADGE_LABEL_MAX_LENGTH}
									placeholder='Badge label, e.g. Night Owl'
									aria-label='Badge label'
									disabled={disabled}
								/>
								<Text
									variant='text-xs'
									color='muted'
									className='tabular-nums shrink-0'
								>
									{field.state.value.length}/{BADGE_LABEL_MAX_LENGTH}
								</Text>
							</div>
							{field.state.value && !label.success ? (
								<Text variant='text-xs' color='destructive'>
									{label.error.issues[0]?.message}
								</Text>
							) : null}
						</div>
					);
				}}
			</form.Field>

			<form.Field name='icon'>
				{(field) => (
					<div
						className='flex flex-wrap gap-1.5'
						role='radiogroup'
						aria-label='Badge icon'
					>
						{BADGE_ICONS.map((icon) => {
							const IconComponent = BADGE_ICON_COMPONENTS[icon];

							return (
								<Button
									key={icon}
									type='button'
									size='icon-sm'
									variant={field.state.value === icon ? 'default' : 'outline'}
									role='radio'
									aria-checked={field.state.value === icon}
									aria-label={icon}
									disabled={disabled}
									onClick={() => field.handleChange(icon)}
								>
									<IconComponent size={16} />
								</Button>
							);
						})}
					</div>
				)}
			</form.Field>

			<form.Field name='color'>
				{(field) => (
					<div
						className='flex flex-wrap gap-2'
						role='radiogroup'
						aria-label='Badge colour'
					>
						{BADGE_COLORS.map((color) => (
							<button
								key={color}
								type='button'
								role='radio'
								aria-checked={field.state.value === color}
								aria-label={color}
								disabled={disabled}
								onClick={() => field.handleChange(color)}
								className={cn(
									'size-7 rounded-full border-2 border-transparent disabled:opacity-50',
									BADGE_COLOR_CLASSES[color],
									field.state.value === color && 'border-foreground',
								)}
							/>
						))}
					</div>
				)}
			</form.Field>

			<form.Subscribe selector={(state) => state.values}>
				{(badge) => {
					const label = badgeLabelSchema.safeParse(badge.label);

					return (
						<div className='flex items-center justify-between gap-4'>
							<div className='flex items-center gap-2 min-w-0'>
								<Text variant='text-xs' color='muted'>
									Preview
								</Text>
								{label.success ? (
									<UserBadge badge={{ ...badge, label: label.data }} />
								) : null}
							</div>
							<div className='flex gap-2'>
								{claim ? (
									<Button
										type='button'
										variant='outline'
										size='sm'
										className='gap-2'
										disabled={isPending}
										onClick={remove}
									>
										<IconTrash size={14} />
										Remove
									</Button>
								) : null}
								<Button
									type='submit'
									size='sm'
									disabled={disabled || !label.success}
								>
									Save
								</Button>
							</div>
						</div>
					);
				}}
			</form.Subscribe>
		</form>
	);
}

export default BadgeEditor;
