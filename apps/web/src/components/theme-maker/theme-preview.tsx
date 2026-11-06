import { memo, useState } from 'react';

import { SettingsScene } from '~/components/theme-maker/scene-settings';
import { ProfileScene } from '~/components/theme-maker/scene-profile';
import { Segmented, SegmentedItem } from '~/components/ui/segmented';
import { ServerScene } from '~/components/theme-maker/scene-server';
import type { SceneColors } from '~/lib/theme-maker/scene-tokens';
import { ChatScene } from '~/components/theme-maker/scene-chat';
import { HomeScene } from '~/components/theme-maker/scene-home';

type ThemePreviewProps = {
	colors: SceneColors;
};

type Scene = 'home' | 'server' | 'chat' | 'profile' | 'settings';

const SCENES: { value: Scene; label: string; Component: typeof HomeScene }[] = [
	{ value: 'home', label: 'Home', Component: HomeScene },
	{ value: 'server', label: 'Server', Component: ServerScene },
	{ value: 'chat', label: 'Chat', Component: ChatScene },
	{ value: 'profile', label: 'Profile', Component: ProfileScene },
	{ value: 'settings', label: 'Settings', Component: SettingsScene },
];

/**
 * @description The phone preview, with tabs switching between Discord's home, server, chat, profile and settings.
 * @param props The scene colours.
 * @returns The preview.
 */
function ThemePreview({ colors }: ThemePreviewProps) {
	const [scene, setScene] = useState<Scene>('chat');
	const Component = SCENES.find((entry) => entry.value === scene)?.Component ?? ChatScene;

	return (
		// The tabs span the phone's width, so the card's padding reads the same on every side.
		<div className='flex flex-col gap-4 mx-auto w-full max-w-[360px]'>
			<div className='-m-1 p-1 overflow-x-auto hide-scrollbar'>
				<Segmented value={scene} aria-label='Preview screen' className='w-full'>
					{SCENES.map((entry) => (
						<SegmentedItem
							key={entry.value}
							value={entry.value}
							className='flex-1 justify-center px-2'
							asChild
						>
							<button
								type='button'
								aria-pressed={scene === entry.value}
								onClick={() => setScene(entry.value)}
							>
								<span>{entry.label}</span>
							</button>
						</SegmentedItem>
					))}
				</Segmented>
			</div>
			<Component colors={colors} />
		</div>
	);
}

// Memoised so a dragged colour picker re-renders it only once the deferred colours settle.
export default memo(ThemePreview);
