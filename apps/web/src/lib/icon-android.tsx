import { Icon, type IconProps } from 'nucleo-micro-bold';

/**
 * @description The Android robot's head, drawn in the `nucleo-micro-bold` style because that set ships none.
 * @param props The icon props, passed through to the shared `Icon` wrapper.
 * @returns The Android glyph.
 */
export function IconAndroid(props: IconProps) {
	return (
		<Icon size='20px' {...props}>
			<path
				d='m3,16a7,7 0 0 1 14,0Zm4.2-4a1,1 0 1 0 0,2a1,1 0 1 0 0-2Zm5.6,0a1,1 0 1 0 0,2a1,1 0 1 0 0-2Z'
				fill='currentColor'
				fillRule='evenodd'
				strokeWidth='0'
			/>
			<path
				d='m6,5l1.25,2.5m6.75-2.5l-1.25,2.5'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth='2'
				data-color='color-2'
			/>
		</Icon>
	);
}

export default { IconAndroid };
