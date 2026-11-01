import type { DocsComment, DocsReflection } from '~/lib/docs/typedoc';
import { getDescription, getDocComment } from '~/lib/docs/comment';
import { typeToParts, type TypePart } from '~/lib/docs/type-parts';
import type { DocsRenderContext } from '~/lib/docs/docs-links';
import { getSignatureHeader } from '~/lib/docs/declaration';
import TypeView from '~/components/docs/type-view';
import DocText from '~/components/docs/doc-text';
import Text from '~/components/ui/text';

type CodeBlockProps = {
	parts: TypePart[];
	ctx: DocsRenderContext;
};

type SignatureBlockProps = {
	reflection: DocsReflection;
	signature: DocsReflection;
	ctx: DocsRenderContext;
};

type ParameterRowProps = {
	parameter: DocsReflection;
	/** The declaration's comment, whose `@param` tags describe a function-typed variable's parameters. */
	comment: DocsComment | undefined;
	ctx: DocsRenderContext;
};

/**
 * @description A declaration as a code panel.
 * @param props The parts and the page's render context.
 * @returns The panel.
 */
export function CodeBlock({ parts, ctx }: CodeBlockProps) {
	return (
		<pre className='bg-muted/60 px-4 py-3 border rounded-control overflow-x-auto whitespace-pre-wrap'>
			<TypeView parts={parts} route={ctx.route} />
		</pre>
	);
}

function ParameterRow({ parameter, comment, ctx }: ParameterRowProps) {
	const tag = comment?.blockTags?.find(
		(entry) => entry.tag === '@param' && entry.name === parameter.name,
	);
	const description = parameter.comment?.summary.length
		? parameter.comment.summary
		: tag?.content;

	return (
		<tr className='border-b last:border-b-0 align-top'>
			<td className='px-3 py-2.5 font-mono text-[0.8125rem] whitespace-nowrap'>
				{parameter.flags.isRest ? '...' : ''}
				{parameter.name}
				{parameter.flags.isOptional ? (
					<span className='text-muted-foreground'>?</span>
				) : null}
			</td>
			<td className='px-3 py-2.5'>
				{parameter.type ? (
					<TypeView parts={typeToParts(parameter.type, ctx)} route={ctx.route} />
				) : null}
				{parameter.defaultValue ? (
					<Text variant='text-xs' color='muted' className='mt-1'>
						Default <code className='font-mono'>{parameter.defaultValue}</code>
					</Text>
				) : null}
			</td>
			<td className='px-3 py-2.5 text-sm'>
				{description ? <DocText parts={description} ctx={ctx} /> : null}
			</td>
		</tr>
	);
}

/**
 * @description One call signature: its declaration, parameter table and return value.
 * @param props The page's reflection, the signature and the page's render context.
 * @returns The block.
 */
function SignatureBlock({ reflection, signature, ctx }: SignatureBlockProps) {
	const comment = getDocComment(reflection);
	const own = signature.comment && signature.comment !== reflection.comment;
	const returns = (signature.comment ?? comment)?.blockTags?.find(
		(tag) => tag.tag === '@returns',
	);
	const parameters = signature.parameters ?? [];

	return (
		<div className='flex flex-col gap-4'>
			<CodeBlock parts={getSignatureHeader(reflection, signature, ctx)} ctx={ctx} />
			{own && reflection.signatures && reflection.signatures.length > 1 ? (
				<DocText parts={getDescription(signature.comment)} ctx={ctx} />
			) : null}

			{parameters.length ? (
				<section className='flex flex-col gap-2'>
					<Text as='h3' variant='text-sm' className='font-semibold'>
						Parameters
					</Text>
					<div className='border rounded-control overflow-x-auto'>
						<table className='w-full text-sm border-collapse'>
							<thead className='bg-muted/50 text-muted-foreground text-left'>
								<tr className='border-b'>
									<th className='px-3 py-2 font-medium'>Name</th>
									<th className='px-3 py-2 font-medium'>Type</th>
									<th className='px-3 py-2 font-medium'>Description</th>
								</tr>
							</thead>
							<tbody>
								{parameters.map((parameter) => (
									<ParameterRow
										key={parameter.id}
										parameter={parameter}
										comment={comment}
										ctx={ctx}
									/>
								))}
							</tbody>
						</table>
					</div>
				</section>
			) : null}

			<section className='flex flex-col gap-2'>
				<Text as='h3' variant='text-sm' className='font-semibold'>
					Returns
				</Text>
				<div className='flex flex-col gap-1'>
					<TypeView
						parts={signature.type ? typeToParts(signature.type, ctx) : []}
						route={ctx.route}
					/>
					{returns ? <DocText parts={returns.content} ctx={ctx} /> : null}
				</div>
			</section>
		</div>
	);
}

export default SignatureBlock;
