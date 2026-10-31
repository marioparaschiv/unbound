import { useMediaQuery } from '@base-ui/react/unstable-use-media-query';

/**
 * @description Whether the viewport is phone-sized, below Tailwind's `sm` breakpoint; false while server rendering.
 * @returns Whether menus should open as bottom sheets with touch-sized rows.
 */
function useIsMobile(): boolean {
	return useMediaQuery('(max-width: 639px)', {});
}

export default useIsMobile;
