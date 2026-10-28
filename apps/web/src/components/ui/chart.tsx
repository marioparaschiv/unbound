import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { createContext, useContext, useId, useMemo } from 'react';
import * as RechartsPrimitive from 'recharts';

import type { CssVariables } from '~/lib/css-variables';
import cn from '~/lib/cn';

// Each theme name maps to the selector its colours apply under.
const THEMES = { light: '', dark: '.dark' } as const;

type ChartTheme = keyof typeof THEMES;

type ChartColor =
	| { color?: string; theme?: never }
	| { color?: never; theme: Record<ChartTheme, string> };

type ChartSeries = {
	label?: ReactNode;
	icon?: ComponentType;
} & ChartColor;

type ChartConfig = Record<string, ChartSeries>;

type ChartContextValue = {
	config: ChartConfig;
};

type ChartContainerProps = ComponentProps<'div'> & {
	config: ChartConfig;
	children: ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
};

type ChartStyleProps = {
	id: string;
	config: ChartConfig;
};

type TooltipIndicator = 'line' | 'dot' | 'dashed';

type ChartTooltipContentProps = RechartsPrimitive.DefaultTooltipContentProps<
	ValueType,
	NameType
> & {
	active?: boolean;
	className?: string;
	color?: string;
	hideLabel?: boolean;
	hideIndicator?: boolean;
	indicator?: TooltipIndicator;
	nameKey?: string;
	labelKey?: string;
};

type ChartLegendContentProps = ComponentProps<'div'> &
	Pick<RechartsPrimitive.DefaultLegendContentProps, 'payload' | 'verticalAlign'> & {
		hideIcon?: boolean;
		nameKey?: string;
	};

const ChartContext = createContext<ChartContextValue | null>(null);

function useChart(): ChartContextValue {
	const context = useContext(ChartContext);

	if (!context) {
		throw new Error('useChart must be used within a <ChartContainer />');
	}

	return context;
}

// UNKNOWN: recharts data keys and values may also be accessor functions or arrays, which name nothing.
function toKeyName(value: unknown): string | undefined {
	return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

// UNKNOWN: recharts hands tooltip and legend items over as loosely typed records.
function readStringField(source: unknown, key: string): string | undefined {
	if (typeof source !== 'object' || source === null) {
		return undefined;
	}

	const value: unknown = Reflect.get(source, key);

	return typeof value === 'string' ? value : undefined;
}

// UNKNOWN: recharts hands tooltip and legend items over as loosely typed records.
function getPayloadConfig(config: ChartConfig, payload: unknown, key: string) {
	if (typeof payload !== 'object' || payload === null) {
		return undefined;
	}

	const inner: unknown = Reflect.get(payload, 'payload');
	const configKey = readStringField(payload, key) ?? readStringField(inner, key) ?? key;

	return config[configKey] ?? config[key];
}

function ChartStyle({ id, config }: ChartStyleProps) {
	const colorConfig = Object.entries(config).filter(([, series]) => series.theme ?? series.color);

	if (!colorConfig.length) return null;

	const css = Object.entries(THEMES)
		.map(([theme, prefix]) => {
			const variables = colorConfig
				.map(([key, series]) => {
					const color = series.theme?.[theme as ChartTheme] ?? series.color;

					return color ? `  --color-${key}: ${color};` : null;
				})
				.join('\n');

			return `\n${prefix} [data-chart=${id}] {\n${variables}\n}\n`;
		})
		.join('\n');

	return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

function ChartContainer({ id, className, children, config, ...props }: ChartContainerProps) {
	const uniqueId = useId();
	const chartId = `chart-${id ?? uniqueId.replaceAll(':', '')}`;
	const context = useMemo(() => ({ config }), [config]);

	return (
		<ChartContext.Provider value={context}>
			<div
				data-slot='chart'
				data-chart={chartId}
				className={cn(
					"[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
					className,
				)}
				{...props}
			>
				<ChartStyle id={chartId} config={config} />
				<RechartsPrimitive.ResponsiveContainer>
					{children}
				</RechartsPrimitive.ResponsiveContainer>
			</div>
		</ChartContext.Provider>
	);
}

const ChartTooltip = RechartsPrimitive.Tooltip;

function ChartTooltipContent({
	active,
	payload,
	className,
	indicator = 'dot',
	hideLabel = false,
	hideIndicator = false,
	label,
	labelFormatter,
	labelClassName,
	formatter,
	color,
	nameKey,
	labelKey,
}: ChartTooltipContentProps) {
	const { config } = useChart();

	const tooltipLabel = useMemo(() => {
		if (hideLabel || !payload?.length) return null;

		const [item] = payload;
		const key = labelKey ?? toKeyName(item?.dataKey) ?? toKeyName(item?.name) ?? 'value';
		const itemConfig = getPayloadConfig(config, item, key);
		const value =
			!labelKey && typeof label === 'string'
				? (config[label]?.label ?? label)
				: itemConfig?.label;

		if (labelFormatter) {
			return (
				<div className={cn('font-medium', labelClassName)}>
					{labelFormatter(value, payload)}
				</div>
			);
		}

		if (!value) return null;

		return <div className={cn('font-medium', labelClassName)}>{value}</div>;
	}, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

	if (!active || !payload?.length) return null;

	const nestLabel = payload.length === 1 && indicator !== 'dot';

	return (
		<div
			className={cn(
				'border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-item border px-2.5 py-1.5 text-xs shadow-float',
				className,
			)}
		>
			{nestLabel ? null : tooltipLabel}
			<div className='grid gap-1.5'>
				{payload
					.filter((item) => item.type !== 'none')
					.map((item, index) => {
						const key =
							nameKey ?? toKeyName(item.name) ?? toKeyName(item.dataKey) ?? 'value';
						const itemConfig = getPayloadConfig(config, item, key);
						const indicatorColor =
							color ?? readStringField(item.payload, 'fill') ?? item.color;
						const indicatorStyle: CssVariables = {
							'--color-bg': indicatorColor,
							'--color-border': indicatorColor,
						};

						const rowKey = toKeyName(item.dataKey) ?? index;
						const rowClassName = cn(
							'[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5',
							indicator === 'dot' && 'items-center',
						);

						if (formatter && item.value !== undefined && item.name) {
							return (
								<div key={rowKey} className={rowClassName}>
									{formatter(item.value, item.name, item, index, item.payload)}
								</div>
							);
						}

						return (
							<div key={rowKey} className={rowClassName}>
								{itemConfig?.icon ? <itemConfig.icon /> : null}
								{!itemConfig?.icon && !hideIndicator ? (
									<div
										className={cn(
											'shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)',
											{
												'h-2.5 w-2.5': indicator === 'dot',
												'w-1': indicator === 'line',
												'w-0 border-[1.5px] border-dashed bg-transparent':
													indicator === 'dashed',
												'my-0.5': nestLabel && indicator === 'dashed',
											},
										)}
										style={indicatorStyle}
									/>
								) : null}
								<div
									className={cn(
										'flex flex-1 justify-between leading-none',
										nestLabel ? 'items-end' : 'items-center',
									)}
								>
									<div className='grid gap-1.5'>
										{nestLabel ? tooltipLabel : null}
										<span className='text-muted-foreground'>
											{itemConfig?.label ?? item.name}
										</span>
									</div>
									{item.value ? (
										<span className='text-foreground font-mono font-medium tabular-nums'>
											{item.value.toLocaleString()}
										</span>
									) : null}
								</div>
							</div>
						);
					})}
			</div>
		</div>
	);
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
	className,
	hideIcon = false,
	payload,
	verticalAlign = 'bottom',
	nameKey,
}: ChartLegendContentProps) {
	const { config } = useChart();

	if (!payload?.length) return null;

	return (
		<div
			className={cn(
				'flex items-center justify-center gap-4',
				verticalAlign === 'top' ? 'pb-3' : 'pt-3',
				className,
			)}
		>
			{payload
				.filter((item) => item.type !== 'none')
				.map((item) => {
					const key = nameKey ?? toKeyName(item.dataKey) ?? 'value';
					const itemConfig = getPayloadConfig(config, item, key);

					return (
						<div
							key={toKeyName(item.value) ?? key}
							className='[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3'
						>
							{itemConfig?.icon && !hideIcon ? (
								<itemConfig.icon />
							) : (
								<div
									className='h-2 w-2 shrink-0 rounded-[2px]'
									style={{ backgroundColor: item.color }}
								/>
							)}
							{itemConfig?.label}
						</div>
					);
				})}
		</div>
	);
}

export type { ChartConfig };

export {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartLegend,
	ChartLegendContent,
	ChartStyle,
};

export default {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartLegend,
	ChartLegendContent,
	ChartStyle,
};
