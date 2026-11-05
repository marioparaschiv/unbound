import { Icon, type IconProps } from 'nucleo-micro-bold';

/**
 * @description The eye with a slash through it, drawn in the `nucleo-micro-bold` style because that set ships none.
 * @param props The icon props, passed through to the shared `Icon` wrapper.
 * @returns The eye-slash glyph.
 */
export function IconEyeSlash(props: IconProps) {
	return (
		<Icon size='20px' {...props}>
			<path
				d='m3.361,11.314c-.481-.8-.481-1.829,0-2.629.962-1.714,3.175-4.686,6.639-4.686s5.677,2.971,6.639,4.686c.481.8.481,1.829,0,2.629-.962,1.714-3.175,4.686-6.639,4.686s-5.677-2.857-6.639-4.686Z'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth='2'
			/>
			<circle
				cx='10'
				cy='10'
				r='3'
				fill='currentColor'
				strokeWidth='0'
				data-color='color-2'
			/>
			<path
				d='m3.5,16.5L16.5,3.5'
				fill='none'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth='2'
			/>
		</Icon>
	);
}

export default { IconEyeSlash };
