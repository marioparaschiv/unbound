//! The selected view's properties, in cards drawn like the Components inspector's: what its listing
//! says at once, then the class chain and sections the device reads on selection.

use gpui::{AnyElement, Context, FontWeight, SharedString, div, prelude::*, px};
use unbound_devtools_core::{PropertyKind, PropertyValue, ViewDetails, ViewNode, ViewProperty};

use super::rows::visibility_label;
use super::{Details, ViewFinder};
use crate::theme;
use crate::widgets::{badge, hairline};

/// The gap around and between the cards, as the inspector spaces its sections.
const CARD_GAP: f32 = 10.;
/// The details pane: wide enough for a member's name, type and value on one row.
const EXPLORER_WIDTH: f32 = 520.;
const CARD_HEADER_HEIGHT: f32 = 34.;

/// A property's value, coloured by kind as the inspector colours props.
enum Value {
	String(String),
	Number(f64, Option<String>),
	/// Several measurements in one, such as padding as `left top right bottom` with its unit.
	Measure(String),
	Literal(&'static str),
	/// A `#RRGGBBAA` colour, drawn with a swatch.
	Color(String),
}

fn optional_string(value: Option<&String>) -> Value {
	value.map_or(Value::Literal("null"), |value| Value::String(value.clone()))
}

fn number(value: f64) -> Value {
	Value::Number(value, None)
}

fn device_value(property: &ViewProperty) -> Value {
	match (&property.value, property.kind) {
		(PropertyValue::String(hex), Some(PropertyKind::Color)) => Value::Color(hex.clone()),
		(PropertyValue::String(text), _) => match &property.unit {
			Some(unit) => Value::Measure(format!("{text} {unit}")),
			None => Value::String(text.clone()),
		},
		(PropertyValue::Number(value), _) => Value::Number(*value, property.unit.clone()),
		(PropertyValue::Bool(true), _) => Value::Literal("true"),
		(PropertyValue::Bool(false), _) => Value::Literal("false"),
		(PropertyValue::Null, _) => Value::Literal("null"),
	}
}

/// Parses `#RRGGBBAA` for a swatch.
fn swatch_color(hex: &str) -> Option<gpui::Rgba> {
	let digits = hex.strip_prefix('#')?;
	(digits.len() == 8)
		.then(|| u32::from_str_radix(digits, 16).ok())
		.flatten()
		.map(gpui::rgba)
}

fn swatch(color: gpui::Rgba) -> impl IntoElement {
	div()
		.flex_none()
		.size(px(12.))
		.rounded(px(3.))
		.border_1()
		.border_color(hairline())
		.bg(color)
}

fn property(key: impl Into<SharedString>, value: Value) -> AnyElement {
	let fill = match &value {
		Value::Color(hex) => swatch_color(hex),
		_ => None,
	};
	let (text, color) = match value {
		Value::String(text) => (format!("\"{text}\""), theme::SYN_STRING),
		Value::Measure(text) => (text, theme::SYN_NUMBER),
		Value::Number(number, Some(unit)) => (format!("{number} {unit}"), theme::SYN_NUMBER),
		Value::Number(number, None) => (number.to_string(), theme::SYN_NUMBER),
		Value::Literal(text) => (text.to_owned(), theme::SYN_LITERAL),
		Value::Color(hex) => (hex, theme::SYN_STRING),
	};
	let key: SharedString = key.into();
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
		.children(fill.map(swatch))
		.child(
			div()
				.min_w_0()
				.truncate()
				.text_color(theme::color(color))
				.child(text),
		)
		.into_any_element()
}

fn card(title: impl Into<SharedString>, body: Vec<AnyElement>) -> AnyElement {
	let title: SharedString = title.into();
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
		property("alpha", node.alpha.map_or(Value::Literal("null"), number)),
		property("children", number(f64::from(node.child_count))),
	];
	let frame = node.frame;
	let frame = vec![
		property("x", number(frame.x)),
		property("y", number(frame.y)),
		property("width", number(frame.width)),
		property("height", number(frame.height)),
	];
	let text = node
		.text
		.as_ref()
		.map(|text| card("Text", vec![text_block(text.clone(), theme::SYN_STRING)]));
	[card("View", view), card("Frame", frame)]
		.into_iter()
		.chain(text)
		.collect()
}

fn text_block(text: impl Into<SharedString>, tone: theme::Token) -> AnyElement {
	div()
		.mx(px(4.))
		.px(px(8.))
		.py(px(4.))
		.font_family(theme::mono_font())
		.text_size(theme::TEXT_SMALL)
		.line_height(px(18.))
		.text_color(theme::color(tone))
		.child(text.into())
		.into_any_element()
}

/// The class chain, the class first, which names what a native hook can target.
fn class_card(details: &ViewDetails) -> AnyElement {
	let rows = details
		.class_chain
		.iter()
		.enumerate()
		.map(|(depth, class)| {
			let tone = if depth == 0 {
				theme::SYN_COMPONENT
			} else {
				theme::TEXT_SECONDARY
			};
			div()
				.flex()
				.items_center()
				.min_h(theme::VALUE_ROW_HEIGHT)
				.mx(px(4.))
				.px(px(8.))
				.gap(px(6.))
				.font_family(theme::mono_font())
				.text_size(theme::TEXT_SMALL)
				.child(
					div()
						.flex_none()
						.text_color(theme::color(theme::TEXT_FAINT))
						.child(if depth == 0 { "●" } else { "↑" }),
				)
				.child(
					div()
						.min_w_0()
						.truncate()
						.text_color(theme::color(tone))
						.child(class.clone()),
				)
				.into_any_element()
		})
		.collect();
	card("Class", rows)
}

/// The cards the device reads on selection: a note while it reads or after it failed, else the
/// class chain and each section.
fn detail_cards(details: Option<&Details>) -> Vec<AnyElement> {
	match details {
		None => Vec::new(),
		Some(Details::Loading) => vec![card(
			"Properties",
			vec![text_block(
				"Reading the view on the device…",
				theme::TEXT_FAINT,
			)],
		)],
		Some(Details::Failed(error)) => vec![card(
			"Properties",
			vec![text_block(error.clone(), theme::ERROR)],
		)],
		Some(Details::Loaded(details)) => std::iter::once(class_card(details))
			.chain(details.sections.iter().map(|section| {
				let rows = section
					.properties
					.iter()
					.map(|item| property(item.key.clone(), device_value(item)))
					.collect();
				card(section.title.clone(), rows)
			}))
			.collect(),
	}
}

impl ViewFinder {
	/// The selected view's cards, above the explorer's class chain: its listing, then what the
	/// device reads on selection.
	pub(super) fn view_cards(&self) -> Option<AnyElement> {
		let node = self.selected.as_ref().and_then(|id| self.nodes.get(id))?;
		let title = div()
			.flex()
			.items_center()
			.gap(px(6.))
			.px(px(4.))
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
					.text_size(theme::TEXT_SMALL)
					.text_color(theme::color(theme::TEXT_FAINT))
					.child(format!("#{}", node.id)),
			);
		let column = div()
			.flex()
			.flex_col()
			.gap(px(CARD_GAP))
			.px(px(CARD_GAP))
			.pt(px(CARD_GAP))
			.child(title)
			.children(cards(node))
			.children(detail_cards(self.details.get(&node.id)));
		Some(column.into_any_element())
	}

	/// The details pane: the explorer's page for the selected view, its cards first.
	pub(super) fn render_properties(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let panel = div()
			.w(px(EXPLORER_WIDTH))
			.flex_none()
			.h_full()
			.flex()
			.flex_col()
			.bg(theme::color(theme::PANEL));
		if !self.explorer.is_open() {
			return panel.child(
				div()
					.flex_1()
					.flex()
					.items_center()
					.justify_center()
					.text_color(theme::color(theme::TEXT_MUTED))
					.child("Select a View"),
			);
		}
		panel.child(self.explorer.render(cx))
	}
}
