//! The module list: the mode, Load All, the filter, the status picker, then one row per module with
//! its id, its label and, for one that has not loaded, a Load button; in Keys mode, one row per
//! match with its module and path. Only the rows on screen are drawn.

use gpui::{AnyElement, Context, FontWeight, div, prelude::*, px, uniform_list};
use gpui_component::input::Input;
use unbound_devtools_core::{METRO_MODULES_PAGE_SIZE, MetroModuleStatus};

use super::search::path_prefix;
use super::unfold::{Fold, Place};
use super::{MetroBrowser, Mode, Row};
use crate::explorer::link_button;
use crate::smooth_scroll::SmoothScroll;
use crate::theme;
use crate::widgets::{badge, field, icon, panel_header, segmented};

const ID_WIDTH: f32 = 52.;

impl MetroBrowser {
	/// The fold the list is in, when Files mode opened or closed a folder.
	fn list_fold(&self) -> Option<&Fold> {
		self.files
			.as_ref()
			.filter(|_| self.mode == Mode::Files)?
			.fold
			.as_ref()
	}

	/// Draws the list row shown at `ix`, which a fold can map to a later row.
	fn render_row(&self, ix: usize, cx: &mut Context<Self>) -> Option<AnyElement> {
		let (ix, place) = self
			.list_fold()
			.map_or((ix, Place::Whole), |fold| fold.place(ix));
		let shell = div().w_full().px(px(4.));
		let row = div()
			.id(("metro-row", ix))
			.flex()
			.items_center()
			.gap(px(8.))
			.w_full()
			.h(theme::ROW_HEIGHT)
			.px(px(theme::INSET))
			.rounded(theme::RADIUS_ITEM)
			.whitespace_nowrap()
			.overflow_hidden()
			.font_family(theme::mono_font())
			.text_size(theme::TEXT_MONO);
		let clickable = |row: gpui::Stateful<gpui::Div>| {
			row.cursor_pointer()
				.hover(|row| row.bg(theme::color(theme::HOVER)))
		};
		let listing = self.listing.as_ref();
		let element = match self.rows.get(ix)?.clone() {
			Row::File(index) => {
				let element = self.render_file_row(index, row, cx)?;
				return Some(
					place
						.fit(shell.child(element), theme::ROW_HEIGHT)
						.into_any_element(),
				);
			}
			Row::Module(index) => {
				let module = listing?.modules.get(index)?.clone();
				let id = module.id;
				let selected = self
					.picked
					.as_ref()
					.is_some_and(|picked| picked.module.id == id);
				let loading = self.loading.contains(&id);
				let (label, tone) = match (&module.label, module.status) {
					(Some(label), _) => (label.clone(), theme::SYN_COMPONENT),
					(None, MetroModuleStatus::Loaded) => ("No Exports".into(), theme::TEXT_FAINT),
					(None, MetroModuleStatus::Failed) => {
						("Threw While Loading".into(), theme::TEXT_FAINT)
					}
					(None, MetroModuleStatus::Unloaded) => ("Not Loaded".into(), theme::TEXT_FAINT),
				};
				clickable(row)
					.when(selected, |row| row.bg(theme::accent_soft()))
					.child(
						div()
							.flex_none()
							.w(px(ID_WIDTH))
							.text_color(theme::color(theme::TEXT_MUTED))
							.child(id.to_string()),
					)
					.child(
						div()
							.flex_1()
							.min_w_0()
							.truncate()
							.text_color(theme::color(tone))
							.child(label),
					)
					.map(|row| match module.status {
						_ if loading => row.child(
							div()
								.flex_none()
								.font_family(theme::mono_font())
								.text_size(theme::TEXT_SMALL)
								.text_color(theme::color(theme::TEXT_FAINT))
								.child("Loading…"),
						),
						MetroModuleStatus::Unloaded => {
							row.child(link_button(("metro-load", id), "Load").on_click(
								cx.listener(move |this, _, _, cx| {
									cx.stop_propagation();
									this.load(id, cx);
								}),
							))
						}
						MetroModuleStatus::Failed => row.child(badge("Failed", theme::ERROR)),
						MetroModuleStatus::Loaded => row,
					})
					.on_click(cx.listener(move |this, _, _, cx| this.pick(module.clone(), cx)))
			}
			Row::Match(index) => {
				let found = self.keys.as_ref()?.matches.get(index)?;
				let selected = self.picked.as_ref().is_some_and(|picked| {
					picked.module.id == found.module.id
						&& picked.target.as_ref() == Some(&found.path)
				});
				clickable(row)
					.when(selected, |row| row.bg(theme::accent_soft()))
					.child(
						div()
							.flex_none()
							.w(px(ID_WIDTH))
							.text_color(theme::color(theme::TEXT_MUTED))
							.child(found.module.id.to_string()),
					)
					// The path up to the key truncates first, so the matched key itself stays readable.
					.child(
						div()
							.flex_shrink(1.)
							.min_w_0()
							.truncate()
							.text_color(theme::color(theme::TEXT_FAINT))
							.child(path_prefix(found)),
					)
					.child(
						div()
							.flex_none()
							.max_w(px(180.))
							.truncate()
							.text_color(theme::color(theme::SYN_PROP_KEY))
							.child(found.value.key.clone()),
					)
					.child(div().flex_1())
					.child(
						div()
							.flex_none()
							.max_w(px(120.))
							.truncate()
							.text_size(theme::TEXT_SMALL)
							.text_color(theme::color(theme::TEXT_FAINT))
							.child(found.value.text.clone()),
					)
					.on_click(cx.listener(move |this, _, _, cx| this.pick_match(index, cx)))
			}
			Row::SearchMore => {
				let keys = self.keys.as_ref()?;
				row.font_family(theme::mono_font())
					.text_size(theme::TEXT_SMALL)
					.text_color(theme::color(theme::ACCENT_HOVER))
					.child(format!(
						"Search More · {} of {} Modules Searched",
						keys.searched, keys.total
					))
					.map(clickable)
					.on_click(cx.listener(|this, _, _, cx| this.search_keys(true, cx)))
			}
			Row::Note(text, error) => row
				.font_family(theme::mono_font())
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(if error {
					theme::ERROR
				} else {
					theme::TEXT_FAINT
				}))
				.child(div().min_w_0().truncate().child(text))
				.when(error, |row| {
					row.child(
						link_button("metro-retry", "Retry")
							.on_click(cx.listener(|this, _, _, cx| this.refresh(cx))),
					)
				}),
			Row::More => {
				let listing = listing?;
				let listed = listing.modules.len() as u32;
				let remaining = listing.total.saturating_sub(listed);
				let (text, loading) = match &listing.next {
					Some(Ok(())) => ("Loading…".to_owned(), true),
					Some(Err(error)) => (format!("{error} Click to try again."), false),
					None => (
						format!(
							"Show {} More · {remaining} Not Listed",
							remaining.min(METRO_MODULES_PAGE_SIZE)
						),
						false,
					),
				};
				row.font_family(theme::mono_font())
					.text_size(theme::TEXT_SMALL)
					.text_color(theme::color(if loading {
						theme::TEXT_FAINT
					} else {
						theme::ACCENT_HOVER
					}))
					.child(text)
					.when(!loading, |row| {
						clickable(row)
							.on_click(cx.listener(move |this, _, _, cx| this.list(listed, cx)))
					})
			}
		};
		// The row spans the list, inset so its hover keeps rounded corners on both sides.
		Some(
			place
				.fit(shell.child(element), theme::ROW_HEIGHT)
				.into_any_element(),
		)
	}

	pub(super) fn render_list(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let list = uniform_list(
			"metro-modules",
			self.list_fold()
				.map_or(self.rows.len(), |fold| fold.count(self.rows.len())),
			cx.processor(|this, range: std::ops::Range<usize>, _, cx| {
				range
					.filter_map(|ix| this.render_row(ix, cx))
					.collect::<Vec<_>>()
			}),
		)
		.track_scroll(&self.scroll)
		.flex_1()
		.py(px(4.));
		let statuses: Vec<String> = ["All"]
			.into_iter()
			.chain(MetroModuleStatus::ALL.map(MetroModuleStatus::label))
			.map(str::to_owned)
			.collect();
		let selected = match self.status {
			None => 0,
			Some(status) => {
				1 + MetroModuleStatus::ALL
					.iter()
					.position(|item| *item == status)
					.unwrap_or_default()
			}
		};
		let matches = match self.mode {
			Mode::Modules => self
				.listing
				.as_ref()
				.filter(|listing| !listing.loading && listing.error.is_none())
				.map(|listing| listing.total.to_string()),
			Mode::Keys => self
				.keys
				.as_ref()
				.map(|keys| keys.matches.len().to_string()),
			Mode::Files => self
				.files
				.as_ref()
				.and_then(|files| files.shown())
				.map(|shown| shown.to_string()),
		};
		let modes: Vec<String> = Mode::ALL
			.iter()
			.map(|mode| mode.label().to_owned())
			.collect();
		let mode = Mode::ALL.iter().position(|mode| *mode == self.mode);
		let load_all = match &self.load_all {
			Some(run) => div()
				.flex_none()
				.flex()
				.items_center()
				.gap(px(4.))
				.font_family(theme::mono_font())
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::TEXT_FAINT))
				.child(match (run.stopping, run.remaining) {
					(true, _) => "Stopping…".to_owned(),
					(false, Some(left)) => format!("Loading · {left} Left"),
					(false, None) => "Loading…".to_owned(),
				})
				.when(!run.stopping, |row| {
					row.child(
						link_button("metro-load-all-stop", "Stop")
							.on_click(cx.listener(|this, _, _, cx| this.stop_load_all(cx))),
					)
				})
				.into_any_element(),
			None => link_button("metro-load-all", "Load All")
				.on_click(cx.listener(|this, _, _, cx| this.start_load_all(cx)))
				.into_any_element(),
		};
		div()
			.flex_none()
			.w(px(420.))
			.h_full()
			.flex()
			.flex_col()
			.child(
				panel_header()
					.child(
						div()
							.flex_none()
							.font_weight(FontWeight::MEDIUM)
							.text_color(theme::color(theme::TEXT_SECONDARY))
							.child(self.mode.label()),
					)
					.children(matches.map(|total| badge(total, theme::TEXT_MUTED)))
					.child(div().flex_1())
					.child(load_all),
			)
			.child(
				div()
					.flex_none()
					.flex()
					.flex_col()
					.gap(px(8.))
					.px(px(10.))
					.py(px(8.))
					.child(segmented(
						"metro-mode",
						&modes,
						mode,
						cx.listener(|this, picked: &usize, window, cx| {
							if let Some(mode) = Mode::ALL.get(*picked) {
								this.set_mode(*mode, window, cx);
							}
						}),
					))
					.child(field(
						Input::new(&self.search)
							.prefix(icon(crate::assets::SEARCH, theme::ICON, theme::TEXT_MUTED))
							.cleanable(true),
					))
					.when(self.mode == Mode::Modules, |column| {
						column.child(segmented(
							"metro-status",
							&statuses,
							Some(selected),
							cx.listener(|this, picked: &usize, _, cx| {
								let status = picked
									.checked_sub(1)
									.and_then(|ix| MetroModuleStatus::ALL.get(ix).copied());
								this.set_status(status, cx);
							}),
						))
					}),
			)
			.child(
				div()
					.flex_1()
					.min_h_0()
					.flex()
					.flex_col()
					.child(SmoothScroll::new("metro-glide", &self.scroll, list)),
			)
	}
}
