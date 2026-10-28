import type { AddonMdLine } from '~/lib/addon-md-diff';
import { TONES } from '~/components/dashboard/status';

type AddonMdDiffViewProps = {
	lines: AddonMdLine[];
};

type LineRowProps = {
	line: AddonMdLine;
};

const ROW_STYLES = {
	context: { sign: ' ', className: 'text-muted-foreground' },
	added: { sign: '+', className: TONES.success.pill },
	removed: { sign: '-', className: TONES.danger.pill },
} as const;

const NUMBER_CLASS = 'px-2 w-0 text-muted-foreground/60 text-right align-top select-none';

function LineRow({ line }: LineRowProps) {
	if (line.type === 'skipped') {
		return (
			<tr className='bg-muted/50 text-muted-foreground'>
				<td colSpan={4} className='px-3 py-1 font-sans'>
					{line.count === 1 ? '1 unchanged line' : `${line.count} unchanged lines`}
				</td>
			</tr>
		);
	}

	const style = ROW_STYLES[line.type];

	return (
		<tr className={style.className}>
			<td className={NUMBER_CLASS}>{line.before}</td>
			<td className={NUMBER_CLASS}>{line.after}</td>
			<td className='px-2 w-0 whitespace-pre align-top select-none'>{style.sign}</td>
			<td className='pr-3 wrap-anywhere whitespace-pre-wrap'>{line.text}</td>
		</tr>
	);
}

/** A unified line diff with the old and new line numbers, added lines green and removed red. */
function AddonMdDiffView({ lines }: AddonMdDiffViewProps) {
	return (
		<div className='border border-border rounded-control max-h-[32rem] overflow-auto'>
			<table className='w-full font-mono text-xs leading-5 border-collapse'>
				<tbody>
					{lines.map((line, index) => (
						<LineRow key={index} line={line} />
					))}
				</tbody>
			</table>
		</div>
	);
}

export default AddonMdDiffView;
