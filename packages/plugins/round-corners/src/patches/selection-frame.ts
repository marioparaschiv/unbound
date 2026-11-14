import type { AnyProps } from '@unbound-app/api/metro';
import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

type FrameProps = { circle?: boolean; selected?: boolean; isDragTarget?: boolean };

/**
 * @description Gives the server list's item frames their pre-redesign `circle` back, so servers sit in round frames and only the
 * selected one keeps a rounded square, unless every server should be round. Patches `GuildsBarAnimatedItemWrapper`.
 * @returns A function that stops waiting for the module when it has not loaded yet.
 */
export function patchSelectionFrame(): () => void {
	return metro.onModuleLoaded(
		metro.filters.byFilePath('modules/guilds_bar/native/GuildsBarAnimatedItemWrapper.tsx'),
		(module: AnyProps) => {
			if (typeof module.default !== 'function') return;

			patcher.before(module, 'default', ({ args }) => {
				const props: FrameProps | undefined = args[0];

				if (!settings.serverIcons || !props || props.circle || props.isDragTarget) return;
				if (props.selected && settings.selectedShape !== 'round') return;

				return [{ ...props, circle: true }, ...args.slice(1)];
			});
		},
		{ interop: false },
	);
}

export default patchSelectionFrame;
