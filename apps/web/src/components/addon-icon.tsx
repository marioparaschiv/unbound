import type { AddonType } from '@unbound-app/contracts/addons';
import type { ComponentType } from 'react';
import { IconColorPalette, IconGrid, IconPlug } from 'nucleo-micro-bold';

import cn from '~/lib/cn';

type FallbackIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

const FALLBACKS: Record<AddonType, FallbackIcon> = {
	plugin: IconPlug,
	theme: IconColorPalette,
	'icon-pack': IconGrid,
	font: IconPlug,
};

type AddonIconProps = {
	type: AddonType;
	/** Server-rendered markup of the icon a maintainer picked; `null` for the type's default. */
	svg: string | null;
	className?: string;
};

/** An addon's website icon: the one its maintainers picked, else its type's default. */
function AddonIcon({ type, svg, className }: AddonIconProps) {
	if (svg) {
		// The markup comes from our own icon components on the server, never from user input.
		return (
			<span
				className={cn('inline-flex [&>svg]:size-full shrink-0', className)}
				aria-hidden
				dangerouslySetInnerHTML={{ __html: svg }}
			/>
		);
	}

	const Fallback = FALLBACKS[type];

	return <Fallback className={className} aria-hidden />;
}

export default AddonIcon;
