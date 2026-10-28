import { IconCheck, IconSortArrows } from 'nucleo-micro-bold';
import { useState } from 'react';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
	BottomSheet,
	BottomSheetContent,
	BottomSheetTitle,
	BottomSheetTrigger,
} from '~/components/ui/bottom-sheet';
import type { ListingSort } from '~/lib/prototype/addon-filters';
import { SORT_OPTIONS } from '~/lib/prototype/addon-filters';
import { buttonVariants } from '~/components/ui/button';
import useIsMobile from '~/hooks/use-is-mobile';
import cn from '~/lib/cn';

type SortMenuProps = {
	value: ListingSort;
	onChange: (sort: ListingSort) => void;
};

/**
 * @description One "Sort by" menu; each order brings its own direction, so there is no separate toggle.
 * @param props The current sort and its change handler.
 * @returns The menu.
 */
function SortMenu({ value, onChange }: SortMenuProps) {
	const current = SORT_OPTIONS.find((option) => option.value === value);
	const mobile = useIsMobile();
	const [open, setOpen] = useState(false);
	const triggerClassName = cn(
		buttonVariants({ variant: 'outline' }),
		'flex-1 sm:flex-none min-w-23 shrink-0',
	);
	const label = (
		<>
			<IconSortArrows size={24} />
			<span>{current?.label ?? 'Sort'}</span>
		</>
	);

	if (mobile) {
		return (
			<BottomSheet open={open} onOpenChange={setOpen}>
				<BottomSheetTrigger className={triggerClassName}>{label}</BottomSheetTrigger>
				<BottomSheetContent>
					<BottomSheetTitle className='px-5 py-2'>Sort by</BottomSheetTitle>
					<div role='radiogroup' aria-label='Sort by' className='flex flex-col p-1.5'>
						{SORT_OPTIONS.map((option) => (
							<button
								key={option.value}
								type='button'
								role='radio'
								aria-checked={option.value === value}
								onClick={() => {
									onChange(option.value);
									setOpen(false);
								}}
								className='flex justify-between items-center active:bg-accent px-3.5 rounded-menu-item min-h-12 text-base text-left transition-colors corner-continuous'
							>
								{option.label}
								{option.value === value ? (
									<IconCheck className='size-5 text-primary' />
								) : null}
							</button>
						))}
					</div>
				</BottomSheetContent>
			</BottomSheet>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className={triggerClassName}>{label}</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='w-52'>
				<DropdownMenuLabel>Sort by</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={value}
					onValueChange={(next) => {
						const option = SORT_OPTIONS.find((candidate) => candidate.value === next);

						if (option) {
							onChange(option.value);
						}
					}}
				>
					{SORT_OPTIONS.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export default SortMenu;
