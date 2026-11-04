import type { HttpTagGroup } from '~/lib/docs/http-reference';
import MethodBadge from '~/components/http/method-badge';
import cn from '~/lib/cn';

type HttpSidebarProps = {
	groups: HttpTagGroup[];
	/** The section in view. */
	active: string | undefined;
};

/**
 * @description The HTTP reference's sidebar: each tag's label, then its operations, linking to their sections.
 * @param props The groups and the section in view.
 * @returns The sidebar.
 */
function HttpSidebar({ groups, active }: HttpSidebarProps) {
	return (
		<nav aria-label='HTTP reference' className='flex flex-col gap-5'>
			{groups.map((group) => (
				<div key={group.name} className='flex flex-col gap-0.5'>
					<p className='px-2 pb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wide'>
						{group.name}
					</p>
					{group.operations.map((entry) => (
						<a
							key={entry.anchor}
							href={`#${entry.anchor}`}
							title={`${entry.method} ${entry.path}`}
							data-active={entry.anchor === active}
							className={cn(
								'flex items-center gap-2.5 px-2 rounded-item h-8 text-sm press-flat outline-none focus-visible:ring-[3px] focus-visible:ring-halo',
								entry.anchor === active
									? 'bg-accent text-foreground'
									: 'text-muted-foreground hover:bg-accent/50',
							)}
						>
							<MethodBadge method={entry.method} />
							<span className='single-line'>{entry.operation.summary}</span>
						</a>
					))}
				</div>
			))}
		</nav>
	);
}

export default HttpSidebar;
