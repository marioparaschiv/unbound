import { createUnboundLink } from '@unbound-app/contracts/links';
import type { AddonType } from '@unbound-app/contracts/addons';
import { IconDownload } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { toast } from 'sonner';

import type { ButtonProps } from '~/components/ui/button';
import { canOpenUnboundLinks } from '~/lib/unbound-links';
import { Button } from '~/components/ui/button';

type InstallAddonButtonProps = Pick<ButtonProps, 'className' | 'size' | 'variant'> & {
	id: string;
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

const COPY_FALLBACK_DELAY_MS = 2500;

function InstallAddonButton({
	id,
	type,
	manifestUrl,
	iconOnly = false,
	className,
	size,
	variant,
}: InstallAddonButtonProps) {
	const cancelFallback = useRef<(() => void) | null>(null);

	useEffect(() => () => cancelFallback.current?.(), []);

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

	// A page can't tell whether a custom scheme opened anything; leaving the page is the only signal.
	function offerFallback() {
		cancelFallback.current?.();

		function onVisibilityChange() {
			if (document.visibilityState === 'hidden') {
				cancel();
			}
		}

		function cancel() {
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			cancelFallback.current = null;
		}

		const timer = setTimeout(() => {
			cancel();
			toast("Didn't open Unbound?", {
				description: 'Copy the link and paste it into Unbound instead.',
				action: { label: 'Copy link', onClick: () => void copy() },
			});
		}, COPY_FALLBACK_DELAY_MS);

		document.addEventListener('visibilitychange', onVisibilityChange);
		cancelFallback.current = cancel;
	}

	function onClick(event: MouseEvent<HTMLAnchorElement>) {
		if (canOpenUnboundLinks(navigator)) {
			offerFallback();

			return;
		}

		event.preventDefault();
		void copy();
	}

	return (
		<Button asChild className={className} size={size} variant={variant}>
			<a
				aria-label='Install'
				href={createUnboundLink({ action: 'install', id })}
				onClick={onClick}
			>
				<IconDownload />
				{iconOnly ? null : 'Install'}
			</a>
		</Button>
	);
}

export default InstallAddonButton;
