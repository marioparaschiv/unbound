import type { ComponentType, ReactNode } from 'react';

type IconProps = {
	className?: string;
};

type SearchEmptyProps = {
	icon: ComponentType<IconProps>;
	children: ReactNode;
};

/**
 * @description What a docs search dialog shows with no results: an icon and a line, centred in the height a full result list takes.
 * @param props The icon and the line.
 * @returns The empty state.
 */
function SearchEmpty({ icon: Icon, children }: SearchEmptyProps) {
	return (
		<div className='flex flex-col justify-center items-center gap-3 p-6 h-96 text-center'>
			<div className='flex justify-center items-center bg-accent shadow-key rounded-control size-10'>
				<Icon className='size-5 text-muted-foreground' />
			</div>
			<p className='max-w-xs text-muted-foreground text-sm text-balance'>{children}</p>
		</div>
	);
}

export default SearchEmpty;
