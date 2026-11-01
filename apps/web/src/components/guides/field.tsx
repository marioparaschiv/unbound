import type { ReactNode } from 'react';

type FieldProps = {
	type?: string;
	required?: boolean;
	default?: string;
	children?: ReactNode;
};

type ParamFieldProps = FieldProps & {
	path: string;
};

type ResponseFieldProps = FieldProps & {
	name: string;
};

type FieldEntryProps = FieldProps & {
	name: string;
};

function FieldEntry({ name, type, required, default: fallback, children }: FieldEntryProps) {
	return (
		<div className='flex flex-col gap-2 py-4 border-b last:border-b-0 first:pt-0'>
			<div className='flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-sm'>
				<span className='font-semibold text-foreground break-all'>{name}</span>
				{type ? (
					<span className='bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground text-xs break-all'>
						{type}
					</span>
				) : null}
				{required ? <span className='text-destructive text-xs'>required</span> : null}
				{fallback === undefined ? null : (
					<span className='text-muted-foreground text-xs break-all'>
						default: {fallback}
					</span>
				)}
			</div>
			{children ? (
				<div className='flex flex-col gap-3 text-muted-foreground text-sm [&_p]:text-sm [&_p]:leading-6'>
					{children}
				</div>
			) : null}
		</div>
	);
}

/**
 * @description A documented parameter or object key: its path, type, whether it is required, and its default.
 * @param props The field.
 * @returns The field.
 */
export function ParamField({ path, ...props }: ParamFieldProps) {
	return <FieldEntry name={path} {...props} />;
}

/**
 * @description A documented property of a returned value or file.
 * @param props The field.
 * @returns The field.
 */
export function ResponseField({ name, ...props }: ResponseFieldProps) {
	return <FieldEntry name={name} {...props} />;
}

export default { ParamField, ResponseField };
