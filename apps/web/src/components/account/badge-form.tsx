import {
	BADGE_COLORS,
	BADGE_ICONS,
	BADGE_LABEL_MAX_LENGTH,
	badgeLabelSchema,
} from '@unbound-app/contracts/sponsors';
import type { Badge } from '@unbound-app/contracts/sponsors';
import { useForm } from '@tanstack/react-form';

import UserBadge, { BADGE_COLOR_CLASSES, BADGE_ICON_COMPONENTS } from '~/components/user-badge';
import { Button } from '~/components/ui/button';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type BadgeFormProps = {
	initial: Badge;
	disabled: boolean;
	/** Resolves `true` once saved, which closes the form. */
	onSave: (badge: Badge) => Promise<boolean>;
	onCancel: () => void;
};

/** Edits one badge: its label, icon and colour, with a live preview. */
function BadgeForm({ initial, disabled, onSave, onCancel }: BadgeFormProps) {
	const form = useForm({
		defaultValues: initial,
		onSubmit: async ({ value }) => {
			if (await onSave({ ...value, label: value.label.trim() })) {
				onCancel();
			}
		},
	});

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
			className='flex flex-col gap-4 rounded-control border p-3'
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
									autoFocus
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
								<Button
									type='button'
									variant='outline'
									size='sm'
									disabled={disabled}
									onClick={onCancel}
								>
									Cancel
								</Button>
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

export default BadgeForm;
