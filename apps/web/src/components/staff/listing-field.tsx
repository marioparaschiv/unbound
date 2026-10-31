import type { AddonType } from '@unbound-app/contracts/addons';
import { IconPen } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';
import { useState } from 'react';

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select';
import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import { FieldError } from '~/components/ui/field';
import { Button } from '~/components/ui/button';
import Textarea from '~/components/ui/textarea';
import Input from '~/components/ui/input';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';
import cn from '~/lib/cn';

type FieldIssue = {
	message?: string;
};

type ListingControl = 'input' | 'textarea' | 'type';

type ListingFieldProps = {
	label: string;
	/** The staff override; `null` follows the served manifest. */
	value: string | null;
	/** The served manifest's value, as stored. */
	manifestValue: string;
	editable: boolean;
	control: ListingControl;
	errors: (FieldIssue | undefined)[];
	onChange: (value: string | null) => void;
	/** Renders the value the way the store page shows it. */
	children: (value: string) => ReactNode;
	className?: string;
};

type ModeToggleProps = {
	custom: boolean;
	onFollow: () => void;
	onCustom: () => void;
};

type ControlProps = {
	control: ListingControl;
	label: string;
	value: string;
	invalid: boolean;
	onChange: (value: string) => void;
};

export const TYPE_LABELS: Record<AddonType, string> = {
	plugin: 'Plugin',
	theme: 'Theme',
	'icon-pack': 'Icon pack',
	font: 'Font',
};

/**
 * @description Reads an addon type from a control's string value.
 * @param value The value.
 * @returns The type, or `undefined` when the value names none.
 */
export function toAddonType(value: string): AddonType | undefined {
	return Object.keys(TYPE_LABELS).find((type): type is AddonType => type === value);
}

function describe(control: ListingControl, value: string): string {
	const type = control === 'type' ? toAddonType(value) : undefined;

	return type ? TYPE_LABELS[type] : value;
}

function ModeToggle({ custom, onFollow, onCustom }: ModeToggleProps) {
	return (
		<Segmented value={custom ? 'custom' : 'follow'} className='h-9'>
			<SegmentedItem value='follow' asChild className='h-7 text-xs'>
				<button type='button' aria-pressed={!custom} onClick={onFollow}>
					<span>Follow manifest</span>
				</button>
			</SegmentedItem>
			<SegmentedItem value='custom' asChild className='h-7 text-xs'>
				<button type='button' aria-pressed={custom} onClick={onCustom}>
					<span>Custom</span>
				</button>
			</SegmentedItem>
		</Segmented>
	);
}

function Control({ control, label, value, invalid, onChange }: ControlProps) {
	if (control === 'type') {
		return (
			<Select
				items={TYPE_LABELS}
				value={value}
				onValueChange={(next) => {
					if (next) {
						onChange(next);
					}
				}}
			>
				<SelectTrigger className='w-48' aria-label={label} aria-invalid={invalid}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{Object.entries(TYPE_LABELS).map(([type, typeLabel]) => (
						<SelectItem key={type} value={type}>
							{typeLabel}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}

	const Element = control === 'textarea' ? Textarea : Input;

	return (
		<Element
			autoFocus
			aria-label={label}
			value={value}
			aria-invalid={invalid}
			onChange={(event) => onChange(event.target.value)}
		/>
	);
}

/** A store-page value staff edit in place: it follows the manifest until they give it a custom value. */
function ListingField({
	label,
	value,
	manifestValue,
	editable,
	control,
	errors,
	onChange,
	children,
	className,
}: ListingFieldProps) {
	const [editing, setEditing] = useState(false);
	const custom = value !== null;
	const shown = value ?? manifestValue;
	const display = describe(control, shown);
	const manifestDisplay = describe(control, manifestValue);

	if (!editable) {
		return <div className={className}>{children(display)}</div>;
	}

	if (!editing) {
		return (
			<div
				className={cn(
					'group/listing relative -mx-2 px-2 py-1 rounded-control outline-1 outline-transparent hover:outline-border has-[:focus-visible]:outline-border outline-dashed hover:bg-accent/40 has-[:focus-visible]:bg-accent/40 min-w-0 transition-colors cursor-pointer',
					errors.length > 0 && 'outline-destructive',
					className,
				)}
			>
				<span className='flex items-center gap-2 min-w-0'>
					<span className='min-w-0'>{children(display)}</span>
					{custom ? <Tag variant='primary'>Custom</Tag> : null}
					<span className='hidden group-hover/listing:inline-flex group-has-[:focus-visible]/listing:inline-flex items-center gap-1 bg-card shadow-surface px-2 py-0.5 border rounded-full font-semibold text-muted-foreground text-xs whitespace-nowrap shrink-0'>
						<IconPen className='size-3' />
						Edit
					</span>
				</span>
				{/* The button covers the field, so the store-page text keeps its own semantics. */}
				<button
					type='button'
					onClick={() => setEditing(true)}
					aria-label={`Edit ${label.toLowerCase()}`}
					className='absolute inset-0 rounded-control outline-none cursor-pointer'
				/>
			</div>
		);
	}

	return (
		<div
			className={cn(
				'flex flex-col gap-3 bg-card shadow-float p-4 border rounded-surface animate-reveal',
				className,
			)}
			onKeyDown={(event) => {
				if (event.key === 'Escape') {
					setEditing(false);
				}
			}}
		>
			<div className='flex flex-wrap items-center gap-3'>
				<Text as='span' variant='text-sm' className='font-semibold'>
					{label}
				</Text>
				<ModeToggle
					custom={custom}
					onFollow={() => onChange(null)}
					onCustom={() => onChange(value ?? manifestValue)}
				/>
				<Button
					type='button'
					size='sm'
					variant='secondary'
					className='ml-auto'
					onClick={() => setEditing(false)}
				>
					Done
				</Button>
			</div>
			{custom ? (
				<Control
					control={control}
					label={label}
					value={value}
					invalid={errors.length > 0}
					onChange={onChange}
				/>
			) : (
				<Text
					variant='text-sm'
					color='muted'
					className='bg-muted/50 px-3 py-2 rounded-control whitespace-pre-wrap'
				>
					{manifestDisplay || 'Empty'}
				</Text>
			)}
			<Text variant='text-xs' color='muted' className='break-words'>
				{custom
					? `The manifest says: ${manifestDisplay || 'nothing'}. Your value stays through future versions until you follow the manifest again.`
					: 'Shown from the served version’s manifest and updated with each new version.'}
			</Text>
			<FieldError errors={errors} />
		</div>
	);
}

export default ListingField;
