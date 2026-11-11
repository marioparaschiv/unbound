use gpui::{
	AnyView, App, BoxShadow, Context, Div, FontWeight, Hsla, Pixels, SharedString, Stateful,
	StyledText, Svg, TextRun, Window, div, point, prelude::*, px, svg,
};

use crate::press::Pressable;
use crate::theme::{self, Token};

pub fn icon(path: &'static str, size: gpui::Pixels, color: Token) -> Svg {
	svg()
		.path(path)
		.flex_none()
		.size(size)
		.text_color(theme::color(color))
}

pub fn chevron(expanded: bool) -> Svg {
	let path = if expanded {
		crate::assets::CHEVRON_DOWN
	} else {
		crate::assets::CHEVRON_RIGHT
	};
	icon(path, theme::CHEVRON, theme::TEXT_MUTED)
}

pub fn badge(text: impl Into<SharedString>, fg: Token) -> Div {
	div()
		.flex_none()
		.flex()
		.items_center()
		.h(px(16.))
		.px(px(5.))
		.rounded(px(4.))
		.bg(theme::color(theme::SYN_HOC_BG))
		.text_color(theme::color(fg))
		.text_size(px(11.))
		.line_height(px(16.))
		.child(text.into())
}

struct Tooltip(SharedString);

impl Render for Tooltip {
	fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
		div()
			.font_family(theme::ui_font())
			.text_size(theme::TEXT_SMALL)
			.text_color(theme::color(theme::TEXT))
			.px(px(8.))
			.py(px(4.))
			.rounded(theme::RADIUS_CONTROL)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(theme::color(theme::BORDER_STRONG))
			.shadow(float_shadow())
			.child(self.0.clone())
	}
}

pub fn tooltip(text: &'static str) -> impl Fn(&mut Window, &mut App) -> AnyView + 'static {
	move |_, cx| cx.new(|_| Tooltip(text.into())).into()
}

pub fn icon_button(id: &'static str, path: &'static str, active: bool) -> Stateful<Div> {
	div()
		.id(id)
		.flex_none()
		.size(theme::ICON_BUTTON)
		.flex()
		.items_center()
		.justify_center()
		.rounded(theme::RADIUS_CONTROL)
		.cursor_pointer()
		.when(active, |button| button.bg(theme::accent_soft()))
		.hover(|button| button.bg(theme::color(theme::HOVER)))
		.child(icon(
			path,
			theme::ICON,
			if active {
				theme::ACCENT_HOVER
			} else {
				theme::TEXT_SECONDARY
			},
		))
}

/// A flat button with an icon. A disabled one dims to the web's 50% and ignores hover; the caller
/// skips its click handler.
pub fn ghost_button(
	id: &'static str,
	path: &'static str,
	label: impl Into<SharedString>,
	enabled: bool,
) -> Stateful<Div> {
	div()
		.id(id)
		.flex_none()
		.flex()
		.items_center()
		.gap(px(6.))
		.h(theme::ICON_BUTTON)
		.px(px(8.))
		.rounded(theme::RADIUS_CONTROL)
		.text_size(theme::TEXT_SMALL)
		.text_color(theme::color(theme::TEXT_SECONDARY))
		.map(|button| {
			if enabled {
				button.cursor_pointer().hover(|button| {
					button
						.bg(theme::color(theme::HOVER))
						.text_color(theme::color(theme::TEXT))
				})
			} else {
				button.opacity(0.5)
			}
		})
		.child(icon(path, theme::ICON, theme::TEXT_SECONDARY))
		.child(label.into())
}

/// The web's raised surface: a solid ledge `depth` below the body and a highlight along its top edge.
pub fn ledge_with_highlight(ledge: Hsla, highlight: f32, depth: Pixels) -> Vec<BoxShadow> {
	vec![
		BoxShadow {
			color: gpui::white().opacity(highlight),
			offset: point(px(0.), px(1.)),
			blur_radius: px(0.),
			spread_radius: px(0.),
			inset: true,
		},
		BoxShadow {
			color: ledge,
			offset: point(px(0.), depth),
			blur_radius: px(0.),
			spread_radius: px(0.),
			inset: false,
		},
	]
}

/// The web's `--float-shadow`, for popovers and tooltips.
pub fn float_shadow() -> Vec<BoxShadow> {
	let dark = theme::is_dark();
	vec![
		BoxShadow {
			color: gpui::black().opacity(if dark { 0.35 } else { 0.08 }),
			offset: point(px(0.), px(2.)),
			blur_radius: px(6.),
			spread_radius: px(0.),
			inset: false,
		},
		BoxShadow {
			color: gpui::black().opacity(if dark { 0.5 } else { 0.12 }),
			offset: point(px(0.), px(18.)),
			blur_radius: px(44.),
			spread_radius: px(-10.),
			inset: false,
		},
	]
}

/// The brand ledge colour, the web's `--ledge-primary`.
pub fn primary_ledge() -> Hsla {
	gpui::rgb(0x771A28).into()
}

/// The web button variants that stand on a ledge.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Raised {
	Primary,
	Secondary,
	/// The web's `destructive`: a secondary body with destructive text.
	Destructive,
}

/// The web's raised button. Its body is [`theme::CONTROL_HEIGHT`] less the ledge and the ledge
/// takes layout space below it, so its footprint matches a field beside it. A disabled one dims to
/// 50%, ledge included, and ignores hover and press; the caller skips its click handler.
pub fn raised_button(
	id: impl Into<gpui::ElementId>,
	kind: Raised,
	path: Option<&'static str>,
	label: impl Into<SharedString>,
	enabled: bool,
) -> Pressable {
	// The web's `--highlight`: strong on the brand colour, faint on the neutral body.
	let secondary_highlight = if theme::is_dark() { 0.09 } else { 0.6 };
	let (bg, hover, fg, ledge, highlight) = match kind {
		Raised::Primary => (
			theme::color(theme::ACCENT),
			gpui::rgb(0xBC4753),
			theme::ON_ACCENT,
			primary_ledge(),
			0.18,
		),
		Raised::Secondary => (
			theme::color(theme::SECONDARY),
			theme::color(theme::SECONDARY_HOVER),
			theme::TEXT,
			theme::hsla(theme::LEDGE_SECONDARY),
			secondary_highlight,
		),
		Raised::Destructive => (
			theme::color(theme::SECONDARY),
			theme::color(theme::SECONDARY_HOVER),
			theme::ERROR,
			theme::hsla(theme::LEDGE_SECONDARY),
			secondary_highlight,
		),
	};
	let body = div()
		.flex_none()
		.flex()
		.items_center()
		.justify_center()
		.gap(px(6.))
		.h(theme::CONTROL_HEIGHT - theme::LEDGE)
		.mb(theme::LEDGE)
		.px(px(16.))
		.rounded(theme::RADIUS_CONTROL)
		.bg(bg)
		.text_size(theme::TEXT_UI)
		.font_weight(FontWeight::SEMIBOLD)
		.text_color(theme::color(fg))
		.map(|button| {
			if enabled {
				button
					.cursor_pointer()
					.hover(move |button| button.bg(hover))
			} else {
				button.opacity(0.5)
			}
		})
		.children(path.map(|path| icon(path, theme::ICON, fg)))
		.child(label.into());
	Pressable::new(id, body, ledge, highlight, enabled)
}

/// The web's `field` utility on a gpui-component input: a well sunk into the panel with an inner
/// shadow and a visible rim, at the control height and radius. Focus turns the rim to the ring.
pub fn field<E: Styled>(input: E) -> E {
	let dark = theme::is_dark();
	input
		.h(theme::CONTROL_HEIGHT)
		.px(px(12.))
		.rounded(theme::RADIUS_CONTROL)
		.text_size(theme::TEXT_UI)
		.bg(theme::color(theme::FIELD))
		.border_color(if dark {
			gpui::rgba(0xFFFFFF1C)
		} else {
			gpui::rgba(0x0000001C)
		})
		.shadow(vec![
			BoxShadow {
				color: gpui::black().opacity(if dark { 0.45 } else { 0.07 }),
				offset: point(px(0.), px(2.)),
				blur_radius: px(if dark { 4. } else { 3. }),
				spread_radius: px(0.),
				inset: true,
			},
			BoxShadow {
				color: gpui::white().opacity(if dark { 0.05 } else { 0.8 }),
				offset: point(px(0.), px(-1.)),
				blur_radius: px(0.),
				spread_radius: px(0.),
				inset: true,
			},
		])
}

/// The web's `--key-shadow`: a top highlight and a small drop, for the pill on a segmented track.
fn key_shadow() -> Vec<BoxShadow> {
	let dark = theme::is_dark();
	vec![
		BoxShadow {
			color: gpui::white().opacity(if dark { 0.09 } else { 0.8 }),
			offset: point(px(0.), px(1.)),
			blur_radius: px(0.),
			spread_radius: px(0.),
			inset: true,
		},
		BoxShadow {
			color: gpui::black().opacity(if dark { 0.4 } else { 0.08 }),
			offset: point(px(0.), px(1.)),
			blur_radius: px(2.),
			spread_radius: px(0.),
			inset: false,
		},
	]
}

/// The admin dashboard's Segmented control: equal items on a ringed track, the chosen one on a
/// raised pill. `on_pick` gets the clicked item's index.
pub fn segmented(
	id: impl Into<gpui::ElementId>,
	items: &[String],
	selected: Option<usize>,
	on_pick: impl Fn(&usize, &mut Window, &mut App) + 'static,
) -> Stateful<Div> {
	let on_pick = std::rc::Rc::new(on_pick);
	let id = id.into();
	div()
		.id(id.clone())
		.flex()
		.gap(px(2.))
		.h(theme::CONTROL_HEIGHT)
		.p(px(3.))
		.rounded(theme::RADIUS_CONTROL)
		.bg(theme::color(theme::ELEVATED))
		.border_1()
		.border_color(hairline())
		.children(items.iter().enumerate().map(|(ix, label)| {
			let active = selected == Some(ix);
			let on_pick = on_pick.clone();
			div()
				.id(ix)
				.flex_1()
				.flex()
				.items_center()
				.justify_center()
				// Concentric: the track radius less its border and padding.
				.rounded(theme::RADIUS_CONTROL - px(4.))
				.cursor_pointer()
				.text_size(theme::TEXT_UI)
				.font_weight(FontWeight::SEMIBOLD)
				.map(|item| {
					if active {
						item.bg(theme::color(theme::SECONDARY_HOVER))
							.shadow(key_shadow())
							.text_color(theme::color(theme::TEXT))
					} else {
						item.text_color(theme::color(theme::TEXT_MUTED))
							.hover(|item| item.text_color(theme::color(theme::TEXT)))
					}
				})
				.child(label.clone())
				.on_click(move |_, window, cx| on_pick(&ix, window, cx))
		}))
}

pub fn eyebrow(text: &str) -> Div {
	div()
		.text_size(theme::TEXT_EYEBROW)
		.font_weight(FontWeight::MEDIUM)
		.text_color(theme::color(theme::TEXT_MUTED))
		.child(text.to_uppercase())
}

/// The CLI's help text with its `code` spans in the mono font and their backticks dropped, as
/// Markdown would show them. Text with an unpaired backtick shows as written.
pub fn prose(text: &str, color: Token) -> StyledText {
	let run = |part: &str, code: bool| TextRun {
		len: part.len(),
		font: gpui::font(if code {
			theme::mono_font()
		} else {
			theme::ui_font()
		}),
		color: theme::hsla(if code { theme::TEXT } else { color }),
		background_color: None,
		underline: None,
		strikethrough: None,
	};
	if text.matches('`').count() % 2 == 1 {
		return StyledText::new(text.to_owned()).with_runs(vec![run(text, false)]);
	}
	let parts = text
		.split('`')
		.enumerate()
		.filter(|(_, part)| !part.is_empty());
	let runs = parts
		.clone()
		.map(|(ix, part)| run(part, ix % 2 == 1))
		.collect();
	StyledText::new(parts.map(|(_, part)| part).collect::<String>()).with_runs(runs)
}

pub fn panel_header() -> Div {
	div()
		.flex_none()
		.h(theme::PANEL_HEADER_HEIGHT)
		.flex()
		.items_center()
		.gap(px(4.))
		.pl(px(theme::INSET + 4.))
		.pr(px(6.))
		.border_b_1()
		.border_color(theme::color(theme::BORDER))
		.bg(theme::color(theme::PANEL))
}

/// The hairline around raised neutral surfaces, the web's `--field-border` weight.
pub fn hairline() -> gpui::Rgba {
	if theme::is_dark() {
		gpui::rgba(0xFFFFFF14)
	} else {
		gpui::rgba(0x00000014)
	}
}

/// The bar along the bottom of the sidebar and every page. One height, border and type size, so
/// the bars meet in one line across the window.
pub fn footer_bar() -> Div {
	div()
		.flex_none()
		.h(theme::FOOTER_HEIGHT)
		.flex()
		.items_center()
		.gap(px(12.))
		.border_t_1()
		.border_color(theme::color(theme::BORDER))
		.bg(theme::color(theme::PANEL))
		.text_size(theme::TEXT_SMALL)
		.line_height(px(16.))
		.text_color(theme::color(theme::TEXT_MUTED))
}

/// A keyboard key, as the web's `Kbd` draws it.
pub fn kbd(key: impl Into<SharedString>) -> Div {
	div()
		.flex_none()
		.flex()
		.items_center()
		.justify_center()
		.h(px(20.))
		.min_w(px(20.))
		.px(px(5.))
		.rounded(theme::RADIUS_ITEM - px(1.))
		.bg(theme::color(theme::SECONDARY))
		.shadow(key_shadow())
		.text_size(theme::TEXT_EYEBROW)
		.font_weight(FontWeight::MEDIUM)
		.text_color(theme::color(theme::TEXT_MUTED))
		.child(key.into())
}

/// The bar across the top of every page: a `group / title` breadcrumb on the left, in a column as
/// wide as [`page_header_end`], so whatever the caller puts between them sits in the true centre.
/// Its height matches the sidebar's header, so the two edges meet.
pub fn page_header(group: &str, title: impl Into<SharedString>) -> Div {
	div()
		.flex_none()
		.h(theme::PAGE_HEADER_HEIGHT)
		.flex()
		.items_center()
		.gap(px(12.))
		.px(px(theme::GUTTER))
		.border_b_1()
		.border_color(theme::color(theme::BORDER))
		.bg(theme::color(theme::APP))
		.text_size(px(14.))
		.line_height(px(20.))
		.child(
			page_header_end()
				.gap(px(8.))
				.child(
					div()
						.flex_none()
						.font_weight(FontWeight::MEDIUM)
						.text_color(theme::color(theme::TEXT_MUTED))
						.child(SharedString::from(group.to_owned())),
				)
				.child(
					div()
						.flex_none()
						.text_color(theme::color(theme::TEXT_FAINT))
						.child("/"),
				)
				.child(
					div()
						.min_w_0()
						.truncate()
						.font_weight(FontWeight::SEMIBOLD)
						.text_color(theme::color(theme::TEXT))
						.child(title.into()),
				),
		)
}

/// One of the page header's two equal outer columns; the right one holds the page's actions.
pub fn page_header_end() -> Div {
	// `flex_1` grows from a zero basis, so both columns are equal whatever they hold.
	div().flex_1().min_w_0().flex().items_center()
}
