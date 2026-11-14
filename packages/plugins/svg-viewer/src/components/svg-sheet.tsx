import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { metro } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { cleanSvg } from '~/lib/svg';

type Target = { name: string; url: string };

type SvgSheetProps = Target & { onClose: () => void };

type Loaded = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; markup: string };

async function load(url: string): Promise<Loaded> {
	const response = await fetch(url);
	const markup = response.ok ? cleanSvg(await response.text()) : undefined;

	return markup ? { state: 'ready', markup } : { state: 'failed' };
}

function SvgSheet({ name, url }: SvgSheetProps) {
	const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
	const { width, height } = useWindowDimensions();
	const SvgXml = metro.findByProps('SvgXml')?.SvgXml;
	const size = Math.min(width - 32, height * 0.6);

	useEffect(() => {
		let current = true;

		void load(url)
			.catch((error: Error) => {
				logger.error(`Failed to load the SVG ${name}:`, error);

				return { state: 'failed' } as const;
			})
			.then((result) => current && setLoaded(result));

		return () => {
			current = false;
		};
	}, [url, name]);

	return (
		<Discord.ActionSheet>
			<View style={{ gap: 12, padding: 16, alignItems: 'center' }}>
				<Discord.Text
					variant='heading-lg/semibold'
					numberOfLines={2}
					style={{ alignSelf: 'stretch' }}
				>
					{name}
				</Discord.Text>
				{loaded.state === 'loading' ? (
					<Discord.Text variant='text-md/normal'>{messages.LOADING}</Discord.Text>
				) : null}
				{loaded.state === 'failed' || (loaded.state === 'ready' && !SvgXml) ? (
					<Discord.Text variant='text-md/normal'>{messages.LOAD_FAILED}</Discord.Text>
				) : null}
				{loaded.state === 'ready' && SvgXml ? (
					<View
						style={{
							width: size,
							height: size,
							borderRadius: 8,
							overflow: 'hidden',
							backgroundColor: '#f2f3f5',
							padding: 12,
						}}
					>
						<SvgXml xml={loaded.markup} width='100%' height='100%' />
					</View>
				) : null}
			</View>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens a sheet that draws an SVG attachment with Discord's own react-native-svg.
 * @param target The file's name and URL.
 */
export function openSvgSheet(target: Target): void {
	openSheet(`unbound-svg-viewer-${target.url}`, SvgSheet, target);
}

export default SvgSheet;
