//! Why a run failed, as `ubd … --json` reported it: a card over the output, and a note under the
//! form field it names.

use gpui::{IntoElement, ParentElement, Styled, div, prelude::FluentBuilder, px};
use unbound_devtools_core::ubd::CommandError;

use crate::theme;
use crate::widgets::prose;

/// Whether the failure is about the field named `name`.
pub fn is_about(error: Option<&CommandError>, name: &str) -> bool {
	error.and_then(|error| error.field.as_deref()) == Some(name)
}

/// The failure's code, message and hint, between the output header and the transcript.
pub fn card(error: &CommandError) -> impl IntoElement {
	div()
		.flex_none()
		.flex()
		.flex_col()
		.gap(px(4.))
		.px(px(theme::GUTTER))
		.py(px(10.))
		.border_b_1()
		.border_color(theme::alpha(theme::ERROR, 0.25))
		.bg(theme::alpha(theme::ERROR, 0.08))
		.child(
			div()
				.flex()
				.items_baseline()
				.gap(px(8.))
				.child(
					div()
						.flex_none()
						.px(px(6.))
						.rounded_full()
						.bg(theme::alpha(theme::ERROR, 0.14))
						.font_family(theme::mono_font())
						.text_size(theme::TEXT_EYEBROW)
						.text_color(theme::color(theme::ERROR))
						.child(error.code.as_str()),
				)
				.child(
					div()
						.flex_1()
						.min_w_0()
						.text_size(theme::TEXT_UI)
						.text_color(theme::color(theme::ERROR))
						.child(error.message.clone()),
				),
		)
		.when_some(error.hint.clone(), |card, hint| {
			card.child(
				div()
					.text_size(theme::TEXT_SMALL)
					.line_height(px(17.))
					.child(prose(&hint, theme::TEXT_SECONDARY)),
			)
		})
}

/// The line under a field the failure names.
pub fn field_note(error: &CommandError) -> impl IntoElement {
	div()
		.text_size(theme::TEXT_SMALL)
		.line_height(px(16.))
		.text_color(theme::color(theme::ERROR))
		.child(error.message.clone())
}
