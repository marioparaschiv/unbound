import { ADMIN_SEARCH_MAX_LENGTH, ADMIN_SEARCH_MIN_LENGTH } from '@unbound-app/contracts/admin';
import { IconChevronDown, IconMagnifier } from 'nucleo-micro-bold';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import Spinner from '~/components/ui/spinner';
import cn from '~/lib/cn';

type SearchChipProps = {
	search: string;
	placeholder: string;
	pending: boolean;
	onSearch: (search: string) => void;
};

type ChipRowProps = {
	children: ReactNode;
};

type ChipMenuProps<T extends string> = {
	label: string;
	value: T | undefined;
	options: Record<T, string>;
	/** The option meaning "no filter". */
	anyLabel: string;
	onChange: (value: T | undefined) => void;
};

/**
 * @description A chip's look: the public filter bar's bordered capsule, lit when it narrows the list.
 * @param active Whether the chip narrows the list.
 * @returns The class names.
 */
export function chipClass(active: boolean): string {
	return cn(
		'inline-flex items-center gap-1.5 px-3 border rounded-control h-11 sm:h-9 font-medium text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-halo press-flat',
		active
			? 'bg-accent text-foreground border-transparent'
			: 'bg-card text-muted-foreground hover:text-foreground hover:bg-accent/50',
	);
}

/**
 * @description The text search that leads the chip row; submits on Enter.
 * @param props The current search, placeholder, pending state and submit handler.
 * @returns The search form.
 */
export function SearchChip({ search, placeholder, pending, onSearch }: SearchChipProps) {
	const [value, setValue] = useState(search);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const trimmed = value.trim();

		if (trimmed.length > 0 && trimmed.length < ADMIN_SEARCH_MIN_LENGTH) return;

		onSearch(trimmed);
	}

	return (
		<form onSubmit={submit} role='search' className='w-full sm:w-72'>
			<InputGroup className='sm:h-9'>
				<InputGroupAddon>
					<IconMagnifier size={24} />
				</InputGroupAddon>
				<InputGroupInput
					aria-label={placeholder}
					placeholder={placeholder}
					minLength={ADMIN_SEARCH_MIN_LENGTH}
					maxLength={ADMIN_SEARCH_MAX_LENGTH}
					value={value}
					onChange={(event) => setValue(event.target.value)}
				/>
				{pending ? (
					<InputGroupAddon align='inline-end'>
						<Spinner />
					</InputGroupAddon>
				) : null}
			</InputGroup>
		</form>
	);
}

/**
 * @description A chip that opens a menu of exclusive options; it reads "Label: Option" once set.
 * @template T The option values.
 * @param props The label, value, options, "any" label and change handler.
 * @returns The chip and its menu.
 */
export function ChipMenu<T extends string>({
	label,
	value,
	options,
	anyLabel,
	onChange,
}: ChipMenuProps<T>) {
	const entries = Object.entries<string>(options);
	const keys = Object.keys(options).filter((key): key is T => key in options);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className={chipClass(value !== undefined)}>
				{label}
				{value === undefined ? null : (
					<span className='text-foreground'>: {options[value]}</span>
				)}
				<IconChevronDown className='size-3 text-muted-foreground' />
			</DropdownMenuTrigger>
			<DropdownMenuContent align='start'>
				<DropdownMenuRadioGroup
					value={value ?? ''}
					onValueChange={(next) => onChange(keys.find((key) => key === next))}
				>
					<DropdownMenuRadioItem value=''>{anyLabel}</DropdownMenuRadioItem>
					{entries.map(([option, optionLabel]) => (
						<DropdownMenuRadioItem key={option} value={option}>
							{optionLabel}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * @description One row: the search, then each filter chip.
 * @param props The chips.
 * @returns The row.
 */
export function ChipRow({ children }: ChipRowProps) {
	return <div className='flex flex-wrap items-center gap-2'>{children}</div>;
}

export default { chipClass, SearchChip, ChipMenu, ChipRow };
