import type { HttpMethod } from '~/lib/api/openapi/openapi-document';
import cn from '~/lib/cn';

type MethodBadgeProps = {
	method: HttpMethod;
	className?: string;
};

const METHOD_TINTS: Record<HttpMethod, string> = {
	GET: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
	POST: 'bg-sky-500/12 text-sky-700 dark:text-sky-400',
	PUT: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
	PATCH: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
	DELETE: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
};

/**
 * @description An HTTP method as a small tinted tag, tinted per method.
 * @param props The method.
 * @returns The badge.
 */
function MethodBadge({ method, className }: MethodBadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex justify-center items-center px-1.5 rounded-[6px] min-w-11 h-5 font-mono font-semibold text-[10px] tracking-wide shrink-0',
				METHOD_TINTS[method],
				className,
			)}
		>
			{/* Trimmed to the cap height, so centring the box centres the capitals, not the line box's descender space. */}
			<span className='[text-box:trim-both_cap_alphabetic]'>{method}</span>
		</span>
	);
}

export default MethodBadge;
