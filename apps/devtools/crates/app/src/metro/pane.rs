//! The picked module on the right: its exports as a tree with chevrons, keys and coloured values,
//! `(…)` for a getter not yet run, Show more for a long object and a badge on a circular value. A
//! module that has not loaded shows its Load button instead. A revealed search match's row hops and
//! flickers as the tree glides to it, then stays highlighted.

use std::time::Duration;

use gpui::{
	Animation, AnimationExt, AnyElement, Context, FontWeight, SharedString, Window, div,
	prelude::*, px, uniform_list,
};
use unbound_devtools_core::{
	METRO_CHILDREN_PAGE_SIZE, MetroErrorCode, MetroModuleStatus, MetroValueKind,
};

use super::reveal::{TREE_PAD, flicker, hop};
use super::tree::{Fetch, Node, Path, Row as TreeRow};
use super::unfold::Place;
use super::{Exports, MetroBrowser, Picked};
use crate::empty::no_device;
use crate::explorer::link_button;
use crate::nav;
use crate::smooth_scroll::SmoothScroll;
use crate::theme::{self, Token};
use crate::widgets::{
	Raised, badge, footer_bar, page_header, panel_header, raised_button, text_tooltip,
	turning_chevron,
};

/// Each level of the tree indents by this much.
const LEVEL: f32 = 14.;

/// A revealed row's hop and flicker, the first fifth held while the tree glides there.
const FLASH: Duration = Duration::from_millis(1100);
/// How much brighter than its resting highlight a revealed row is at the flicker's peak.
const FLASH_PEAK: f32 = 0.4;

fn indent(depth: u32) -> f32 {
	theme::INSET + depth as f32 * LEVEL
}

fn value_tone(kind: MetroValueKind) -> Token {
	match kind {
		MetroValueKind::String => theme::SYN_STRING,
		MetroValueKind::Number => theme::SYN_NUMBER,
		MetroValueKind::Boolean | MetroValueKind::Nullish | MetroValueKind::Symbol => {
			theme::SYN_LITERAL
		}
		MetroValueKind::Function => theme::SYN_FUNCTION,
		MetroValueKind::Class => theme::SYN_KEY_VALUE,
		MetroValueKind::Error => theme::ERROR,
		MetroValueKind::Getter => theme::ACCENT_HOVER,
		MetroValueKind::Array | MetroValueKind::Object | MetroValueKind::Other => {
			theme::TEXT_SECONDARY
		}
	}
}

fn tree_row(id: impl Into<gpui::ElementId>, depth: u32) -> gpui::Stateful<gpui::Div> {
	div()
		.id(id)
		.flex()
		.items_center()
		.gap(px(6.))
		.h(theme::VALUE_ROW_HEIGHT)
		.mx(px(4.))
		.pl(px(indent(depth)))
		.pr(px(theme::INSET))
		.rounded(theme::RADIUS_ITEM)
		.whitespace_nowrap()
		.overflow_hidden()
		.font_family(theme::mono_font())
		.text_size(theme::TEXT_SMALL)
}

/// A centred message filling the pane, with an optional action under it.
fn pane_message(
	title: impl Into<SharedString>,
	body: impl Into<SharedString>,
	tone: Token,
) -> gpui::Div {
	div()
		.flex_1()
		.flex()
		.flex_col()
		.items_center()
		.justify_center()
		.gap(px(6.))
		.px(px(24.))
		.child(
			div()
				.font_weight(FontWeight::SEMIBOLD)
				.text_color(theme::color(tone))
				.child(title.into()),
		)
		.child(
			div()
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::TEXT_MUTED))
				.text_center()
				.child(body.into()),
		)
}

impl MetroBrowser {
	/// Draws the tree row shown at `ix`, which a fold can map to a later row.
	fn render_tree_row(&self, ix: usize, cx: &mut Context<Self>) -> Option<AnyElement> {
		let picked = self.picked.as_ref()?;
		let (ix, place) = picked
			.fold
			.as_ref()
			.map_or((ix, Place::Whole), |fold| fold.place(ix));
		let element = match picked.rows.get(ix)?.clone() {
			TreeRow::Value {
				path,
				depth,
				circular,
			} => {
				let node = self.node_ref(&path)?;
				let value = &node.value;
				let opens = value.expandable() && !circular;
				let getter = value.kind == MetroValueKind::Getter;
				let text: SharedString = match &node.read {
					Fetch::Loading => "Running…".into(),
					Fetch::Failed(error) => error.to_string().into(),
					Fetch::Idle => value.text.clone().into(),
				};
				let tone = match node.read {
					Fetch::Failed(_) => theme::ERROR,
					_ => value_tone(value.kind),
				};
				let turn = picked.turn.as_ref().and_then(|turn| turn.of(&path));
				let flash = picked
					.flash
					.as_ref()
					.filter(|flash| flash.path == path)
					.map(|flash| flash.token);
				let row = tree_row(("metro-value", ix), depth)
					.when(opens || getter, |row| {
						row.cursor_pointer()
							.hover(|row| row.bg(theme::color(theme::HOVER)))
					})
					.child(
						div()
							.flex_none()
							.w(px(theme::CHEVRON_SLOT))
							.flex()
							.justify_center()
							.when(opens, |slot| {
								let open = if node.expanded { 1. } else { 0. };
								slot.child(turning_chevron(turn.unwrap_or(open)))
							}),
					)
					.child(
						div()
							.flex_none()
							.max_w(px(260.))
							.truncate()
							.text_color(theme::color(if value.internal {
								theme::TEXT_MUTED
							} else {
								theme::SYN_PROP_KEY
							}))
							.child(value.key.clone()),
					)
					.child(
						div()
							.flex_none()
							.text_color(theme::color(theme::TEXT_FAINT))
							.child(":"),
					)
					.child(
						div()
							.flex_shrink(1.)
							.min_w_0()
							.truncate()
							.text_color(theme::color(tone))
							.child(text),
					)
					.when(circular, |row| row.child(badge("Circular", theme::WARNING)))
					.when(getter, |row| row.tooltip(text_tooltip("Run this getter")))
					.on_click(cx.listener(move |this, _, _, cx| {
						if getter {
							this.read(path.clone(), cx);
						} else if opens {
							this.toggle(path.clone(), cx);
						}
					}));
				let rest = if theme::is_dark() { 0.22 } else { 0.1 };
				match flash {
					None => row.into_any_element(),
					Some(_) if cx.reduce_motion() => {
						row.bg(theme::accent_soft()).into_any_element()
					}
					Some(token) => row
						.bg(theme::accent_soft())
						.with_animation(
							("metro-flash", token as usize),
							Animation::new(FLASH),
							move |row, delta| {
								row.pl(px(indent(depth) + hop(delta))).bg(theme::alpha(
									theme::ACCENT,
									rest + FLASH_PEAK * flicker(delta),
								))
							},
						)
						.into_any_element(),
				}
			}
			TreeRow::More { path, depth } => {
				let node = self.node_ref(&path)?;
				let children = node.children.as_ref()?;
				let listed = children.properties.len() as u32;
				let remaining = children.total.saturating_sub(listed);
				tree_row(("metro-more", ix), depth)
					.pl(px(indent(depth) + theme::CHEVRON_SLOT + 6.))
					.font_family(theme::mono_font())
					.cursor_pointer()
					.hover(|row| row.bg(theme::color(theme::HOVER)))
					.text_color(theme::color(theme::ACCENT_HOVER))
					.child(format!(
						"Show {} More · {remaining} Not Listed",
						remaining.min(METRO_CHILDREN_PAGE_SIZE)
					))
					.on_click(cx.listener(move |this, _, _, cx| {
						this.fetch_children(path.clone(), listed, cx)
					}))
					.into_any_element()
			}
			TreeRow::Note {
				path,
				depth,
				text,
				error,
			} => tree_row(("metro-note", ix), depth)
				.pl(px(indent(depth) + theme::CHEVRON_SLOT + 6.))
				.font_family(theme::mono_font())
				.text_color(theme::color(if error {
					theme::ERROR
				} else {
					theme::TEXT_FAINT
				}))
				.child(div().min_w_0().truncate().child(text))
				.when(error, |row| {
					let offset = self
						.node_ref(&path)
						.and_then(|node| node.children.as_ref())
						.map_or(0, |children| children.properties.len() as u32);
					row.child(
						link_button(("metro-retry-page", ix), "Retry").on_click(cx.listener(
							move |this, _, _, cx| this.fetch_children(path.clone(), offset, cx),
						)),
					)
				})
				.into_any_element(),
		};
		let row = div().w_full().child(element);
		Some(place.fit(row, theme::VALUE_ROW_HEIGHT).into_any_element())
	}

	fn node_ref(&self, path: &Path) -> Option<&Node> {
		let Exports::Loaded(root) = &self.picked.as_ref()?.exports else {
			return None;
		};
		root.get(path)
	}

	fn render_exports(&self, picked: &Picked, cx: &mut Context<Self>) -> AnyElement {
		let loading = self.loading.contains(&picked.module.id);
		match (&picked.exports, picked.module.status) {
			// A failed Load, or a loaded module whose exports could not be read.
			(Exports::Failed(error), status) => {
				let title = match error.code() {
					Some(MetroErrorCode::Stale) => "The Exports Are Gone",
					Some(MetroErrorCode::Unloaded) => "Not Loaded",
					Some(MetroErrorCode::UnknownModule) => "No Such Module",
					_ if status == MetroModuleStatus::Unloaded => "Can't Load the Module",
					_ => "Can't Read the Exports",
				};
				let id = picked.module.id;
				pane_message(title, error.to_string(), theme::ERROR)
					.child(
						link_button("metro-reopen", "Retry")
							.mt(px(6.))
							.on_click(cx.listener(move |this, _, _, cx| {
								if status == MetroModuleStatus::Unloaded {
									this.load(id, cx);
								} else {
									this.fetch_exports(cx);
								}
							})),
					)
					.into_any_element()
			}
			(_, MetroModuleStatus::Unloaded) => {
				let id = picked.module.id;
				pane_message(
					format!("Module {id} Has Not Loaded"),
					"Loading runs its factory and those of the modules it requires.",
					theme::TEXT_SECONDARY,
				)
				.child(
					div().mt(px(8.)).child(
						raised_button(
							"metro-load-picked",
							Raised::Primary,
							None,
							if loading { "Loading" } else { "Load Module" },
							!loading,
						)
						.when(!loading, |button| {
							button.on_click(cx.listener(move |this, _, _, cx| this.load(id, cx)))
						}),
					),
				)
				.into_any_element()
			}
			(_, MetroModuleStatus::Failed) => pane_message(
				format!("Module {} Threw While Loading", picked.module.id),
				"Its factory failed, so it has no exports.",
				theme::ERROR,
			)
			.into_any_element(),
			(Exports::Loading, _) => pane_message(
				"Reading the Exports",
				"Asking the device.",
				theme::TEXT_FAINT,
			)
			.into_any_element(),
			(Exports::Loaded(_), _) => {
				let list = uniform_list(
					"metro-tree",
					picked
						.fold
						.as_ref()
						.map_or(picked.rows.len(), |fold| fold.count(picked.rows.len())),
					cx.processor(|this, range: std::ops::Range<usize>, _, cx| {
						range
							.filter_map(|ix| this.render_tree_row(ix, cx))
							.collect::<Vec<_>>()
					}),
				)
				.track_scroll(&self.tree_scroll)
				.flex_1()
				.py(px(TREE_PAD));
				div()
					.flex_1()
					.min_h_0()
					.flex()
					.flex_col()
					.child(
						SmoothScroll::new("metro-tree-glide", &self.tree_scroll, list)
							.glide_to(self.tree_glide),
					)
					.into_any_element()
			}
		}
	}

	fn render_pane(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let pane = div()
			.flex_1()
			.min_w_0()
			.h_full()
			.flex()
			.flex_col()
			.bg(theme::color(theme::PANEL));
		let Some(picked) = &self.picked else {
			return pane.child(pane_message(
				"Pick a Module",
				"Its exports open here as a tree.",
				theme::TEXT_MUTED,
			));
		};
		let label = picked.module.label.clone();
		pane.child(
			panel_header()
				.gap(px(8.))
				.child(
					div()
						.flex_none()
						.font_family(theme::mono_font())
						.font_weight(FontWeight::SEMIBOLD)
						.text_color(theme::color(theme::TEXT))
						.child(format!("Module {}", picked.module.id)),
				)
				.children(label.map(|label| {
					div()
						.flex_1()
						.min_w_0()
						.truncate()
						.font_family(theme::mono_font())
						.text_size(theme::TEXT_SMALL)
						.text_color(theme::color(theme::TEXT_MUTED))
						.child(label)
				})),
		)
		.child(self.render_exports(picked, cx))
	}
}

impl Render for MetroBrowser {
	fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		self.settle_folds();
		let unfolding = self.picked.as_ref().is_some_and(|picked| picked.moving())
			|| self.files.as_ref().is_some_and(|files| files.moving());
		if unfolding {
			window.request_animation_frame();
		}
		let body = if self.connected {
			div()
				.flex_1()
				.min_h_0()
				.flex()
				.child(self.render_list(cx))
				.child(div().flex_none().w(px(1.)).bg(theme::color(theme::BORDER)))
				.child(self.render_pane(cx))
				.into_any_element()
		} else {
			no_device(self.link.as_ref()).into_any_element()
		};
		let mut note = match self.counts {
			Some((loaded, count)) => format!("{loaded} of {count} modules loaded"),
			None => String::new(),
		};
		if let Some(load_note) = &self.load_note {
			note = format!("{note} · {load_note}");
		}
		div()
			.size_full()
			.flex()
			.flex_col()
			.child(page_header(nav::COMPONENTS_GROUP, nav::METRO_TITLE))
			.child(body)
			.child(
				// The MCP button pads its label by 8px, so the bar pads 8px less to end on the gutter.
				footer_bar()
					.pl(px(theme::GUTTER))
					.pr(px(theme::GUTTER - 8.))
					.child(div().flex_1().min_w_0().truncate().child(note))
					.child(self.mcp.clone()),
			)
	}
}
