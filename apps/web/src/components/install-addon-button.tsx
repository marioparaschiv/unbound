import type { AddonType } from '@unbound-app/contracts/addons';
import { IconDownload } from 'nucleo-micro-bold';
import { toast } from 'sonner';

import type { ButtonProps } from '~/components/ui/button';
import { Button } from '~/components/ui/button';

type InstallAddonButtonProps = Pick<ButtonProps, 'className' | 'size' | 'variant'> & {
	type: AddonType;
	/** The immutable CDN manifest URL `Addons.install(url)` takes. */
	manifestUrl: string;
	iconOnly?: boolean;
};

const SETTINGS_PAGES: Record<AddonType, string> = {
	plugin: 'Plugins',
	theme: 'Themes',
	'icon-pack': 'Icon Packs',
	font: 'Fonts',
};

// The client installs from a manifest URL pasted into its Install dialog, so installing from the
// web means copying that URL.
function InstallAddonButton({
	type,
	manifestUrl,
	iconOnly = false,
	className,
	size,
	variant,
}: InstallAddonButtonProps) {
	async function copy() {
		try {
			await navigator.clipboard.writeText(manifestUrl);
			toast.success('Install link copied', {
				description: `In Unbound, open ${SETTINGS_PAGES[type]}, tap Install and paste it.`,
			});
		} catch (error) {
			toast.error(`Failed to copy the install link, copy it by hand: ${String(error)}`, {
				description: manifestUrl,
			});
		}
	}

	return (
		<Button
			aria-label='Install'
			className={className}
			size={size}
			variant={variant}
			onClick={copy}
		>
			<IconDownload size={24} />
			{iconOnly ? null : 'Install'}
		</Button>
	);
}

export default InstallAddonButton;
