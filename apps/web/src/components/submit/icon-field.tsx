import { IconChevronExpandY, IconPen } from 'nucleo-micro-bold';
import type { AddonType } from '@unbound-app/contracts/addons';
import { useState } from 'react';

import AtlasIcon, { warmAddonIconAtlas } from '~/components/addon-icon-picker/atlas-icon';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import AddonIconPicker from '~/components/addon-icon-picker/addon-icon-picker';
import AddonIcon from '~/components/addon-icon';
import Text from '~/components/ui/text';

type IconFieldProps = {
	id: string;
	type: AddonType;
	/** The picked icon's name, `null` for the type's default. */
	value: string | null;
	onChange: (icon: string | null) => void;
	disabled: boolean;
};

function iconLabel(name: string): string {
	return (name.slice('Icon'.length).match(/[A-Z][a-z]*|\d+/g) ?? []).join(' ');
}

/**
 * @description The icon a new listing starts with on the site, picked from the same grid as the dashboard's.
 * @param props The addon type, the picked icon and what picking one does.
 * @returns A row showing the icon and its name, which opens the picker.
 */
function IconField({ id, type, value, onChange, disabled }: IconFieldProps) {
	const [open, setOpen] = useState(false);
	const fallback = type === 'theme' ? 'Default palette' : 'Default plug';

	function pick(next: string | null) {
		setOpen(false);
		onChange(next);
	}

	return (
		<Popover modal open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				id={id}
				disabled={disabled}
				// Downloads and decodes the atlas, so the picker opens on a ready image.
				onPointerEnter={() => void warmAddonIconAtlas()}
				className='flex items-center gap-3 hover:bg-accent/40 data-popup-open:bg-accent/60 disabled:opacity-50 px-3 py-2.5 rounded-control outline-none focus-visible:ring-[3px] focus-visible:ring-halo w-full text-left transition-colors press-flat [--press-depth:0.25]'
			>
				<span className='relative flex justify-center items-center bg-accent rounded-control size-10 shrink-0'>
					{value ? (
						<AtlasIcon name={value} />
					) : (
						<AddonIcon type={type} svg={null} className='size-5' />
					)}
					<span className='-right-1 -bottom-1 absolute flex justify-center items-center bg-popover border rounded-full size-4.5'>
						<IconPen className='size-2.5' />
					</span>
				</span>
				<span className='flex flex-col flex-1 min-w-0'>
					<Text as='span' variant='text-sm' className='font-medium truncate'>
						{value ? iconLabel(value) : fallback}
					</Text>
					<Text as='span' variant='text-xs' color='muted' className='truncate'>
						Shown on its card and addon page. You can change it later.
					</Text>
				</span>
				<IconChevronExpandY className='size-3.5 text-muted-foreground shrink-0' />
			</PopoverTrigger>
			<PopoverContent align='start' sideOffset={8} className='p-0 w-fit overflow-hidden'>
				<AddonIconPicker
					value={value}
					onSelect={pick}
					onReset={value ? () => pick(null) : undefined}
					resetLabel={fallback}
				/>
			</PopoverContent>
		</Popover>
	);
}

export default IconField;
