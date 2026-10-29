import type { AddonType } from '@unbound-app/contracts/addons';
import { useMutation } from '@tanstack/react-query';
import { IconPen } from 'nucleo-micro-bold';
import { toast } from 'sonner';

import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import AddonIconPicker from '~/components/addon-icon-picker/addon-icon-picker';
import { warmAddonIconAtlas } from '~/components/addon-icon-picker/atlas-icon';
import { setAddonIconMutation } from '~/queries/dashboard/addon-icon';
import getApiErrorMessage from '~/lib/api/error-message';
import AddonIcon from '~/components/addon-icon';

type AddonIconPopoutProps = {
	addonId: string;
	name: string;
	type: AddonType;
	icon: string | null;
	iconSvg: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** The row's icon tile, which opens the icon picker beside it; the app keeps the manifest's icon. */
function AddonIconPopout({
	addonId,
	name,
	type,
	icon,
	iconSvg,
	open,
	onOpenChange,
}: AddonIconPopoutProps) {
	const change = useMutation(setAddonIconMutation(addonId));

	function save(next: string | null) {
		onOpenChange(false);

		if (next === icon) return;

		change.mutate(next, { onError: (cause) => toast.error(getApiErrorMessage(cause)) });
	}

	return (
		// Modal like Telecord's emoji popout: Base UI locks page scroll with `overflow` alone, no wheel listener.
		<Popover modal open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger
				aria-label={`Change the icon of ${name}`}
				// Downloads and decodes the atlas, so the picker opens on a ready image.
				onPointerEnter={() => void warmAddonIconAtlas()}
				className='group relative flex justify-center items-center bg-accent hover:bg-accent/70 rounded-control outline-none focus-visible:ring-[3px] focus-visible:ring-halo size-10 shrink-0 press-flat'
			>
				<AddonIcon type={type} svg={iconSvg} className='size-5' />
				<span className='-right-1 -bottom-1 absolute flex justify-center items-center bg-popover opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 border rounded-full size-4.5 transition-opacity'>
					<IconPen className='size-2.5' />
				</span>
			</PopoverTrigger>
			<PopoverContent align='start' sideOffset={8} className='p-0 w-fit overflow-hidden'>
				<AddonIconPicker
					value={icon}
					onSelect={save}
					onReset={icon ? () => save(null) : undefined}
					resetLabel={`Default ${type === 'theme' ? 'palette' : 'plug'}`}
				/>
			</PopoverContent>
		</Popover>
	);
}

export default AddonIconPopout;
