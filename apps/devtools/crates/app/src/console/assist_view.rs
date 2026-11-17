//! Draws the completion menu and hover card. Corners are concentric: an inner radius is the
//! outer radius less the padding between them, so the curves share one centre.

use gpui::{
	Anchor, AnyElement, App, Context, FontWeight, HighlightStyle, IntoElement, Pixels, Point,
	StyledText, UnderlineStyle, Window, anchored, deferred, div, point, prelude::*, px,
};
use gpui_component::text::{TextView, TextViewStyle};
use lsp_types::{CompletionItem, CompletionItemKind};

use super::assist::Assist;
use crate::theme::{self, Token};
use crate::widgets::float_shadow;

const RADIUS: Pixels = px(12.);
const MENU_PADDING: Pixels = px(4.);
const ROW_RADIUS: Pixels = px(12. - 4.);
const ROW_HEIGHT: Pixels = px(26.);
const ROW_INSET: Pixels = px(6.);
const BADGE: Pixels = px(16.);
/// Concentric with the row: its radius less the gap around the badge.
const BADGE_RADIUS: Pixels = px(8. - 5.);
const BADGE_GAP: Pixels = px(8.);
const BADGE_TEXT: f32 = 10.;
/// Text centres on cap height, which leaves a lowercase letter low in its square. JetBrains Mono's
/// cap height is 0.73em and x-height 0.55em; lifting by half the difference centres the x-height.
const LOWERCASE_LIFT: Pixels = px(BADGE_TEXT * (0.73 - 0.55) / 2.);
/// The name's line box centres a pixel above its cap height; this puts its caps level with the
/// badge's centre.
const LABEL_DROP: Pixels = px(1.);
const MENU_ROWS: usize = 8;
const CARD_PADDING: Pixels = px(12.);
const GAP: Pixels = px(4.);

/// A completion's kind as its badge letter, colour and name. The colours are the syntax theme's,
/// so a method's badge matches how a method reads in code.
fn kind(kind: Option<CompletionItemKind>) -> (&'static str, Token, &'static str) {
	match kind {
		Some(CompletionItemKind::METHOD) => ("m", theme::SYN_LITERAL, "method"),
		Some(CompletionItemKind::FUNCTION) => ("f", theme::SYN_LITERAL, "function"),
		Some(CompletionItemKind::CONSTRUCTOR) => ("c", theme::SYN_LITERAL, "constructor"),
		Some(CompletionItemKind::PROPERTY | CompletionItemKind::FIELD) => {
			("p", theme::SYN_PROP_KEY, "property")
		}
		Some(CompletionItemKind::VARIABLE) => ("v", theme::SYN_FUNCTION, "variable"),
		Some(CompletionItemKind::CONSTANT) => ("k", theme::SYN_FUNCTION, "constant"),
		Some(CompletionItemKind::CLASS) => ("C", theme::SYN_KEY_VALUE, "class"),
		Some(CompletionItemKind::INTERFACE) => ("I", theme::SYN_KEY_VALUE, "interface"),
		Some(CompletionItemKind::STRUCT) => ("T", theme::SYN_KEY_VALUE, "type"),
		Some(CompletionItemKind::TYPE_PARAMETER) => ("T", theme::SYN_KEY_VALUE, "type parameter"),
		Some(CompletionItemKind::ENUM) => ("E", theme::SYN_KEY_ATTR, "enum"),
		Some(CompletionItemKind::ENUM_MEMBER) => ("e", theme::SYN_KEY_ATTR, "enum member"),
		Some(CompletionItemKind::MODULE) => ("M", theme::SYN_KEY_ATTR, "module"),
		Some(CompletionItemKind::KEYWORD) => ("#", theme::TEXT_MUTED, "keyword"),
		Some(CompletionItemKind::SNIPPET) => ("s", theme::TEXT_MUTED, "snippet"),
		_ => ("·", theme::TEXT_MUTED, ""),
	}
}

/// The kind's square: its letter on a tint of its colour, like VS Code's symbol icons.
fn render_badge(letter: &'static str, tone: Token) -> gpui::Div {
	div()
		.flex_none()
		.size(BADGE)
		.rounded(BADGE_RADIUS)
		.bg(theme::alpha(tone, 0.2))
		.border_1()
		.border_color(theme::alpha(tone, 0.45))
		.flex()
		.items_center()
		.justify_center()
		.font_family(theme::mono_font())
		.text_size(px(BADGE_TEXT))
		.font_weight(FontWeight::BOLD)
		.text_color(theme::color(tone))
		.child(
			div()
				.relative()
				.when(letter.chars().all(char::is_lowercase), |glyph| {
					glyph.top(-LOWERCASE_LIFT)
				})
				.child(letter),
		)
}

/// A floating surface: Unbound's elevated panel, hairline edge and float shadow.
fn surface() -> gpui::Div {
	div()
		.rounded(RADIUS)
		.bg(theme::color(theme::ELEVATED))
		.border_1()
		.border_color(theme::color(theme::BORDER_STRONG))
		.shadow(float_shadow())
		.occlude()
}

/// Where `typed` (lowercase) sits in `label`, ignoring case; empty when it is not there.
fn matched(label: &str, typed: &str) -> std::ops::Range<usize> {
	label
		.to_lowercase()
		.find(typed)
		.map(|start| start..start + typed.len())
		.filter(|range| label.is_char_boundary(range.start) && label.is_char_boundary(range.end))
		.unwrap_or(0..0)
}

fn render_row(ix: usize, item: &CompletionItem, typed: &str, selected: bool) -> AnyElement {
	let label = &item.label;
	// The typed text stays bright wherever it matched; the rest of the name reads as the suggestion.
	let hit = matched(label, typed);
	let faint = |text: &str| {
		div()
			.text_color(theme::color(theme::TEXT_SECONDARY))
			.child(text.to_owned())
	};
	let (letter, tone, name) = kind(item.kind);
	div()
		.id(("completion", ix))
		.h(ROW_HEIGHT)
		.flex_none()
		.flex()
		.items_center()
		.gap(BADGE_GAP)
		.px(ROW_INSET)
		.rounded(ROW_RADIUS)
		.when(selected, |row| row.bg(theme::color(theme::HOVER)))
		.child(render_badge(letter, tone))
		.child(
			div()
				.flex_1()
				.min_w_0()
				.truncate()
				.font_family(theme::mono_font())
				.text_size(theme::TEXT_MONO)
				.child(
					div()
						.relative()
						.top(LABEL_DROP)
						.flex()
						.child(faint(&label[..hit.start]))
						.child(
							div()
								.font_weight(FontWeight::SEMIBOLD)
								.text_color(theme::color(theme::TEXT))
								.child(label[hit.clone()].to_owned()),
						)
						.child(faint(&label[hit.end..])),
				),
		)
		// The kind's name only on the selected row, as VS Code shows details.
		.child(
			div()
				.flex_none()
				.ml(px(8.))
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::TEXT_FAINT))
				.when(selected, |kind| kind.child(name)),
		)
		.into_any_element()
}

/// Where the completion menu goes: its anchor corner and that corner's point.
struct MenuPlacement {
	anchor: Anchor,
	origin: Point<Pixels>,
	height: Pixels,
}

impl Assist {
	/// The names line up with the one under the caret, badges hanging to their left. Below the
	/// line when the menu fits, else above it, so it never covers the code.
	fn menu_placement(&self, window: &Window, cx: &App) -> Option<MenuPlacement> {
		let list = self.live_completions(cx)?;
		let word = self
			.editor
			.read(cx)
			.range_to_bounds(&(list.start..list.start))?;
		let x = word.left() - px(1.) - MENU_PADDING - ROW_INSET - BADGE - BADGE_GAP;
		let height =
			ROW_HEIGHT * list.items.len().min(MENU_ROWS) as f32 + MENU_PADDING * 2. + px(2.);
		let fits_below = word.bottom() + GAP + height + px(8.) <= window.viewport_size().height;
		let (anchor, origin) = if fits_below {
			(Anchor::TopLeft, point(x, word.bottom() + GAP))
		} else {
			(Anchor::BottomLeft, point(x, word.top() - GAP))
		};

		Some(MenuPlacement {
			anchor,
			origin,
			height,
		})
	}

	fn render_menu(&self, window: &Window, cx: &App) -> Option<AnyElement> {
		let list = self.live_completions(cx)?;
		let placement = self.menu_placement(window, cx)?;
		let editor = self.editor.read(cx);
		let typed = editor
			.text()
			.slice(list.start..editor.cursor())
			.to_string()
			.to_lowercase();
		let rows = list
			.items
			.iter()
			.enumerate()
			.map(|(ix, item)| render_row(ix, item, &typed, ix == self.selected));
		let menu = surface()
			.id("completion-menu")
			.min_w(px(220.))
			.max_w(px(420.))
			.max_h(ROW_HEIGHT * MENU_ROWS as f32 + MENU_PADDING * 2.)
			.p(MENU_PADDING)
			.overflow_y_scroll()
			.track_scroll(&self.menu_scroll)
			.font_family(theme::ui_font())
			.flex()
			.flex_col()
			.children(rows);

		Some(
			deferred(
				anchored()
					.anchor(placement.anchor)
					.position(placement.origin)
					.snap_to_window_with_margin(px(8.))
					.child(menu),
			)
			.with_priority(1)
			.into_any_element(),
		)
	}

	/// The call's parameters above the caret's line, the argument being typed bright and underlined.
	/// Over the completion menu when that opens above the line too.
	fn render_signature(&self, window: &Window, cx: &App) -> Option<AnyElement> {
		let card = self.signature.as_ref()?;
		let editor = self.editor.read(cx);
		let caret = editor.range_to_bounds(&(editor.cursor()..editor.cursor()))?;
		let bottom = match self.menu_placement(window, cx) {
			Some(menu) if menu.anchor == Anchor::BottomLeft => menu.origin.y - menu.height - GAP,
			_ => caret.top() - GAP,
		};
		let active = HighlightStyle {
			color: Some(theme::color(theme::TEXT).into()),
			font_weight: Some(FontWeight::BOLD),
			underline: Some(UnderlineStyle {
				thickness: px(1.),
				color: Some(theme::color(theme::TEXT).into()),
				wavy: false,
			}),
			..HighlightStyle::default()
		};
		let label = StyledText::new(card.label.clone())
			.with_highlights((!card.active.is_empty()).then(|| (card.active.clone(), active)));
		let overloads = (card.count > 1).then(|| {
			div()
				.flex_none()
				.font_family(theme::ui_font())
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::TEXT_FAINT))
				.child(format!("{} of {}", card.index + 1, card.count))
		});
		let docs = card.docs.clone().map(|docs| {
			div()
				.mt(px(8.))
				.pt(px(8.))
				.border_t_1()
				.border_color(theme::color(theme::BORDER_STRONG))
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::TEXT_SECONDARY))
				.child(TextView::markdown("signature-docs", docs))
		});
		let body = surface()
			.id("signature-card")
			.max_w(px(560.))
			.max_h(px(220.))
			.overflow_y_scroll()
			.px(CARD_PADDING)
			.py(px(8.))
			.font_family(theme::ui_font())
			.child(
				div()
					.flex()
					.items_start()
					.gap(px(10.))
					.child(
						div()
							.flex_1()
							.min_w_0()
							.font_family(theme::mono_font())
							.text_size(theme::TEXT_MONO)
							.text_color(theme::color(theme::TEXT_MUTED))
							.child(label),
					)
					.children(overloads),
			)
			.children(docs);

		Some(
			deferred(
				anchored()
					.anchor(Anchor::BottomLeft)
					.position(point(caret.left() - CARD_PADDING, bottom))
					.snap_to_window_with_margin(px(8.))
					.child(body),
			)
			.with_priority(1)
			.into_any_element(),
		)
	}

	fn render_hover(&mut self, cx: &mut Context<Self>) -> Option<AnyElement> {
		if !self.live_hover(cx) {
			return None;
		}
		let card = self.hover.as_mut()?;
		let symbol = self.editor.read(cx).range_to_bounds(&card.range)?;
		let signature = card.signature.as_mut().map(|signature| {
			div()
				.font_family(theme::mono_font())
				.text_size(theme::TEXT_MONO)
				.text_color(theme::color(theme::TEXT))
				.child(signature.styled(cx))
		});
		let divider = (signature.is_some() && card.docs.is_some()).then(|| {
			div()
				.h(px(1.))
				.my(px(10.))
				.bg(theme::color(theme::BORDER_STRONG))
		});
		let docs = card.docs.clone().map(|docs| {
			div()
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::TEXT_SECONDARY))
				.child(
					TextView::markdown("hover-docs", docs)
						.style(TextViewStyle::default().paragraph_gap(gpui::rems(0.5)))
						.selectable(true),
				)
		});
		let body = surface()
			.id("hover-card")
			.max_w(px(520.))
			.max_h(px(340.))
			.p(CARD_PADDING)
			.overflow_y_scroll()
			.font_family(theme::ui_font())
			.on_hover(
				cx.listener(|this, hovered: &bool, _, cx| this.set_pointer_on_card(*hovered, cx)),
			)
			.children(signature)
			.children(divider)
			.children(docs);

		Some(
			deferred(
				anchored()
					.anchor(Anchor::BottomLeft)
					.position(point(symbol.left() - CARD_PADDING, symbol.top() - GAP))
					.snap_to_window_with_margin(px(8.))
					.child(body),
			)
			.with_priority(1)
			.into_any_element(),
		)
	}
}

impl Render for Assist {
	fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let menu = self.render_menu(window, cx);
		let signature = self.render_signature(window, cx);
		let hover = self.render_hover(cx);

		div().children(menu).children(signature).children(hover)
	}
}

#[cfg(test)]
mod tests {
	use super::matched;

	#[test]
	fn brightens_the_typed_text_where_it_matched() {
		assert_eq!(matched("codePointAt", "co"), 0..2);
		assert_eq!(matched("localeCompare", "co"), 6..8);
		assert_eq!(matched("concat", ""), 0..0);
		assert_eq!(matched("length", "co"), 0..0);
	}
}
