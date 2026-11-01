import { Link } from '@tanstack/react-router';

import { declarationParts, signatureParts, typeToParts } from '~/lib/docs/type-parts';
import { getDescription, getDocComment, isDeprecated } from '~/lib/docs/comment';
import type { DocsRenderContext } from '~/lib/docs/docs-links';
import { DOCS_GROUPS, ReflectionKind } from '~/lib/docs/kinds';
import { getInheritedFrom } from '~/lib/docs/declaration';
import type { DocsReflection } from '~/lib/docs/typedoc';
import type { DocsMember } from '~/lib/docs/docs-page';
import KindBadge from '~/components/docs/kind-badge';
import TypeView from '~/components/docs/type-view';
import DocText from '~/components/docs/doc-text';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type ObjectMembersProps = {
	members: DocsReflection[];
	ctx: DocsRenderContext;
};

type ObjectMemberProps = {
	member: DocsReflection;
	ctx: DocsRenderContext;
};

type NamespaceMembersProps = {
	members: DocsMember[];
	ctx: DocsRenderContext;
};

function memberParts(member: DocsReflection, ctx: DocsRenderContext) {
	if (member.kind === ReflectionKind.Method && member.signatures?.length) {
		return member.signatures.flatMap((signature) => signatureParts(signature, ctx, false));
	}

	if (member.type) {
		return typeToParts(member.type, ctx);
	}

	return declarationParts(member, ctx);
}

function ObjectMember({ member, ctx }: ObjectMemberProps) {
	const comment = getDocComment(member);
	const inheritedFrom = getInheritedFrom(member, ctx);

	return (
		<div
			id={member.name}
			className='flex flex-col gap-2 px-4 py-3 scroll-mt-24 target:bg-accent/60'
		>
			<div className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
				<a
					href={`#${member.name}`}
					className='font-mono font-semibold text-[0.875rem] hover:underline underline-offset-4'
				>
					{member.flags.isReadonly ? (
						<span className='font-normal text-primary'>readonly </span>
					) : null}
					{member.name}
					{member.flags.isOptional ? (
						<span className='text-muted-foreground'>?</span>
					) : null}
				</a>
				<TypeView parts={memberParts(member, ctx)} route={ctx.route} />
				{isDeprecated(comment) ? <Tag variant='warning'>Deprecated</Tag> : null}
			</div>
			{inheritedFrom.length ? (
				<p className='text-muted-foreground text-xs'>
					Inherited from{' '}
					<TypeView parts={inheritedFrom} route={ctx.route} className='text-xs' />
				</p>
			) : null}
			<DocText parts={getDescription(comment)} ctx={ctx} />
		</div>
	);
}

/**
 * @description An interface's or object type's members, each with an anchor its links jump to.
 * @param props The members and the page's render context.
 * @returns The list.
 */
export function ObjectMembers({ members, ctx }: ObjectMembersProps) {
	return (
		<section className='flex flex-col gap-3'>
			<Text as='h2' variant='heading-sm'>
				Members
			</Text>
			<div className='flex flex-col border rounded-surface divide-y overflow-hidden'>
				{members.map((member) => (
					<ObjectMember key={member.id} member={member} ctx={ctx} />
				))}
			</div>
		</section>
	);
}

/**
 * @description A namespace's members under their kind headings, each linking to its page with its summary.
 * @param props The members and the page's render context.
 * @returns The sections.
 */
export function NamespaceMembers({ members, ctx }: NamespaceMembersProps) {
	return (
		<div className='flex flex-col gap-8'>
			{DOCS_GROUPS.map((group) => {
				const entries = members.filter((member) => member.group === group.key);

				if (!entries.length) return null;

				return (
					<section key={group.key} className='flex flex-col gap-3'>
						<Text as='h2' variant='heading-sm'>
							{group.label}
						</Text>
						<div className='flex flex-col border rounded-surface divide-y overflow-hidden'>
							{entries.map((member) => {
								const location = ctx.resolve(member.id);

								return (
									<div key={member.id} className='flex flex-col gap-1 px-4 py-3'>
										<div className='flex items-center gap-2'>
											<KindBadge group={group.key} />
											{location ? (
												<Link
													to='/docs/$package/$version/$symbol'
													params={{
														...ctx.route,
														symbol: location.symbol,
													}}
													hash={location.anchor}
													className='font-mono font-semibold text-[0.875rem] hover:underline underline-offset-4'
												>
													{member.name}
												</Link>
											) : (
												<span className='font-mono font-semibold text-[0.875rem]'>
													{member.name}
												</span>
											)}
											{member.deprecated ? (
												<Tag variant='warning'>Deprecated</Tag>
											) : null}
										</div>
										<DocText parts={member.summary} ctx={ctx} />
									</div>
								);
							})}
						</div>
					</section>
				);
			})}
		</div>
	);
}

export default { ObjectMembers, NamespaceMembers };
