//! The selected view's top-level properties, in cards drawn like the Components inspector's.

use gpui::{AnyElement, Context, FontWeight, SharedString, div, prelude::*, px};
use unbound_devtools_core::ViewNode;

use super::ViewFinder;
use super::rows::visibility_label;
use crate::smooth_scroll::SmoothScroll;
use crate::theme;
use crate::widgets::{badge, hairline, panel_header};

/// The gap around and between the cards, as the inspector spaces its sections.
const CARD_GAP: f32 = 10.;
const CARD_HEADER_HEIGHT: f32 = 34.;

/// A property's value, coloured by kind as the inspector colours props.
enum Value {
	String(String),
	Number(f64),
	Literal(&'static str),
}

fn optional_string(value: Option<&String>) -> Value {
	value.map_or(Value::Literal("null"), |value| Value::String(value.clone()))
}

fn property(key: &'static str, value: Value) -> AnyElement {
	let (text, color) = match value {
		Value::String(text) => (format!("\"{text}\""), theme::SYN_STRING),
		Value::Number(number) => (number.to_string(), theme::SYN_NUMBER),
		Value::Literal(text) => (text.to_owned(), theme::SYN_LITERAL),
	};
	div()
		.flex()
		.items_center()
		.gap(px(6.))
		.min_h(theme::VALUE_ROW_HEIGHT)
		.mx(px(4.))
		.px(px(8.))
		.rounded(theme::RADIUS_ITEM - px(2.))
		.whitespace_nowrap()
		.overflow_hidden()
		.font_family(theme::mono_font())
		.text_size(theme::TEXT_SMALL)
		.child(
			div()
				.flex_none()
				.text_color(theme::color(theme::SYN_PROP_KEY))
				.child(format!("{key}:")),
		)
		.child(
			div()
				.min_w_0()
				.truncate()
				.text_color(theme::color(color))
				.child(text),
		)
		.into_any_element()
}

fn card(title: &'static str, body: Vec<AnyElement>) -> AnyElement {
	let count = body.len();
	div()
		.flex_none()
		.flex()
		.flex_col()
		.overflow_hidden()
		.rounded(theme::RADIUS_CONTROL)
		.bg(theme::color(theme::ELEVATED))
		.border_1()
		.border_color(hairline())
		.child(
			div()
				.flex_none()
				.flex()
				.items_center()
				.h(px(CARD_HEADER_HEIGHT))
				.px(px(12.))
				.child(
					div()
						.flex_1()
						.text_size(theme::TEXT_SMALL)
						.font_weight(FontWeight::SEMIBOLD)
						.text_color(theme::color(theme::TEXT))
						.child(title),
				)
				.child(
					div()
						.flex_none()
						.text_size(theme::TEXT_EYEBROW)
						.text_color(theme::color(theme::TEXT_MUTED))
						.child(count.to_string()),
				),
		)
		.child(
			div()
				.flex()
				.flex_col()
				.py(px(4.))
				.border_t_1()
				.border_color(hairline())
				.children(body),
		)
		.into_any_element()
}

fn cards(node: &ViewNode) -> Vec<AnyElement> {
	let view = vec![
		property("class", Value::String(node.class_name.clone())),
		property("id", optional_string(node.resource_name.as_ref())),
		property(
			"visibility",
			Value::String(visibility_label(node.visibility).to_owned()),
		),
		property(
			"alpha",
			node.alpha.map_or(Value::Literal("null"), Value::Number),
		),
		property("children", Value::Number(f64::from(node.child_count))),
	];
	let frame = node.frame;
	let frame = vec![
		property("x", Value::Number(frame.x)),
		property("y", Value::Number(frame.y)),
		property("width", Value::Number(frame.width)),
		property("height", Value::Number(frame.height)),
	];
	let text = node.text.as_ref().map(|text| {
		card(
			"Text",
			vec![
				div()
					.mx(px(4.))
					.px(px(8.))
					.py(px(4.))
					.font_family(theme::mono_font())
					.text_size(theme::TEXT_SMALL)
					.line_height(px(18.))
					.text_color(theme::color(theme::SYN_STRING))
					.child(SharedString::from(text.clone()))
					.into_any_element(),
			],
		)
	});
	[card("View", view), card("Frame", frame)]
		.into_iter()
		.chain(text)
		.collect()
}

impl ViewFinder {
	pub(super) fn render_properties(&self, _: &mut Context<Self>) -> impl IntoElement {
		let panel = div()
			.w(px(theme::INSPECTOR_DEFAULT))
			.flex_none()
			.h_full()
			.flex()
			.flex_col()
			.bg(theme::color(theme::PANEL));
		let Some(node) = self.selected.as_ref().and_then(|id| self.nodes.get(id)) else {
			return panel.child(
				div()
					.flex_1()
					.flex()
					.items_center()
					.justify_center()
					.text_color(theme::color(theme::TEXT_MUTED))
					.child("Select a View"),
			);
		};
		panel
			.child(
				panel_header()
					.gap(px(6.))
					.child(
						div()
							.flex_none()
							.max_w(px(240.))
							.truncate()
							.text_size(theme::TEXT_TITLE)
							.font_weight(FontWeight::SEMIBOLD)
							.child(node.short_name().to_owned()),
					)
					.child(badge(
						visibility_label(node.visibility),
						theme::TEXT_SECONDARY,
					))
					.child(div().flex_1())
					.child(
						div()
							.flex_none()
							.pr(px(4.))
							.text_size(theme::TEXT_SMALL)
							.text_color(theme::color(theme::TEXT_FAINT))
							.child(format!("#{}", node.id)),
					),
			)
			.child(SmoothScroll::new(
				"view-cards-glide",
				&self.card_scroll,
				div()
					.id("view-cards")
					.flex_1()
					.min_h_0()
					.overflow_y_scroll()
					.track_scroll(&self.card_scroll)
					.flex()
					.flex_col()
					.gap(px(CARD_GAP))
					.p(px(CARD_GAP))
					.children(cards(node)),
			))
	}
}
