import type { AddonType } from '@unbound-app/contracts/addons';
import { useState } from 'react';

import AtlasIcon, { warmAddonIconAtlas } from '~/components/addon-icon-picker/atlas-icon';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import AddonIconPicker from '~/components/addon-icon-picker/addon-icon-picker';
import AddonIcon from '~/components/addon-icon';
import { Button } from '~/components/ui/button';
import cn from '~/lib/cn';

type AddonIconControlProps = {
	id: string;
	type: AddonType;
	/** The icon the form holds now; `null` is the type's default. */
	value: string | null;
	/** The saved icon and its server-rendered markup, drawn while the form still holds it. */
	saved: string | null;
	savedSvg: string | null;
	onChange: (icon: string | null) => void;
	/** Draws only the tile, which opens the picker; for layouts that label the icon elsewhere. */
	compact?: boolean;
	className?: string;
};

type AddonIconPreviewProps = {
	type: AddonType;
	value: string | null;
	saved: string | null;
	savedSvg: string | null;
	/** The drawn size in px; the atlas needs a number, the markup a class. */
	size: 20 | 24 | 32;
};

const SIZE_CLASSES: Record<AddonIconPreviewProps['size'], string> = {
	20: 'size-5',
	24: 'size-6',
	32: 'size-8',
};

/**
 * @description Draws the icon the form holds: the saved one from its server markup, a new pick from the atlas.
 * @param props The type, the form's icon and the saved icon with its markup.
 * @returns The icon.
 */
export function AddonIconPreview({ type, value, saved, savedSvg, size }: AddonIconPreviewProps) {
	if (value !== null && value !== saved) {
		return <AtlasIcon name={value} size={size} />;
	}

	return (
		<AddonIcon
			type={type}
			svg={value === null ? null : savedSvg}
			className={SIZE_CLASSES[size]}
		/>
	);
}

/** The website icon of an addon in a staff form: a tile that opens the picker, and a reset to the default. */
function AddonIconControl({
	id,
	type,
	value,
	saved,
	savedSvg,
	onChange,
	compact = false,
	className,
}: AddonIconControlProps) {
	const [open, setOpen] = useState(false);
	const fallback = type === 'theme' ? 'palette' : 'plug';

	function pick(icon: string | null) {
		setOpen(false);
		onChange(icon);
	}

	const picker = (
		<Popover modal open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				id={id}
				type='button'
				aria-label='Change the website icon'
				// Downloads and decodes the atlas, so the picker opens on a ready image.
				onPointerEnter={() => void warmAddonIconAtlas()}
				className={cn(
					'flex justify-center items-center bg-accent hover:bg-accent/70 border rounded-surface outline-none focus-visible:ring-[3px] focus-visible:ring-halo shrink-0 press-flat',
					compact ? 'size-16' : 'size-12',
				)}
			>
				<AddonIconPreview
					type={type}
					value={value}
					saved={saved}
					savedSvg={savedSvg}
					size={compact ? 32 : 24}
				/>
			</PopoverTrigger>
			<PopoverContent align='start' sideOffset={8} className='p-0 w-fit overflow-hidden'>
				<AddonIconPicker
					value={value}
					onSelect={pick}
					onReset={value ? () => pick(null) : undefined}
					resetLabel={`Default ${fallback}`}
				/>
			</PopoverContent>
		</Popover>
	);

	if (compact) {
		return picker;
	}

	return (
		<div className={cn('flex items-center gap-3', className)}>
			{picker}
			<Button type='button' variant='outline' size='sm' onClick={() => setOpen(true)}>
				Change icon
			</Button>
			{value ? (
				<Button type='button' variant='ghost' size='sm' onClick={() => onChange(null)}>
					Use default {fallback}
				</Button>
			) : null}
		</div>
	);
}

export default AddonIconControl;
