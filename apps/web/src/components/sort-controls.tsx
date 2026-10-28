import { IconAscendingSorting, IconDescendingSorting, IconSortArrows } from 'nucleo-micro-bold';
import { sortOrderSchema, type SortOrder } from '@unbound-app/contracts/addons';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import { Button } from '~/components/ui/button';

type SortOption<T extends string> = {
	value: T;
	label: string;
};

type SortControlsProps<T extends string> = {
	options: SortOption<T>[];
	value: T;
	order: SortOrder;
	onChange: (value: T, order: SortOrder) => void;
};

const ORDER_LABELS: Record<SortOrder, string> = { asc: 'Ascending', desc: 'Descending' };

function SortControls<T extends string>({ options, value, order, onChange }: SortControlsProps<T>) {
	function selectValue(next: string) {
		const option = options.find((candidate) => candidate.value === next);

		if (!option) return;

		onChange(option.value, order);
	}

	function selectOrder(next: string) {
		const parsed = sortOrderSchema.safeParse(next);

		if (!parsed.success) return;

		onChange(value, parsed.data);
	}

	return (
		<>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant='outline'
							type='button'
							className='min-w-23'
							onClick={() => onChange(value, order === 'asc' ? 'desc' : 'asc')}
						>
							{order === 'asc' ? (
								<IconAscendingSorting size={24} />
							) : (
								<IconDescendingSorting size={24} />
							)}
							<span className='hidden sm:inline'>
								{order === 'asc' ? 'Asc' : 'Desc'}
							</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>{ORDER_LABELS[order]}</TooltipContent>
				</Tooltip>
			</TooltipProvider>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant='outline' type='button' className='min-w-23'>
						<IconSortArrows size={24} />
						<span className='hidden sm:inline'>Sort</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align='end'>
					<DropdownMenuLabel>Property</DropdownMenuLabel>
					<DropdownMenuRadioGroup value={value} onValueChange={selectValue}>
						{options.map((option) => (
							<DropdownMenuRadioItem key={option.value} value={option.value}>
								{option.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator />
					<DropdownMenuLabel>Direction</DropdownMenuLabel>
					<DropdownMenuRadioGroup value={order} onValueChange={selectOrder}>
						{sortOrderSchema.options.map((option) => (
							<DropdownMenuRadioItem key={option} value={option}>
								{ORDER_LABELS[option]}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}

export type { SortOption };

export default SortControls;
