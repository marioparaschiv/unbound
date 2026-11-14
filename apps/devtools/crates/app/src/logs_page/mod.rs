//! The Logs page: the device's log lines live as they arrive, filtered by source
//! (All, JS, React Native, Native) and to Unbound's lines alone, sorted by when the device wrote
//! them, oldest or newest first. It follows the newest line while scrolled to its end.

mod rows;

use std::collections::VecDeque;
use std::sync::Arc;
use std::time::Duration;

use gpui::{
	Context, Entity, ScrollStrategy, SharedString, UniformListScrollHandle, Window, div,
	prelude::*, px,
};
use gpui_component::switch::Switch;
use unbound_devtools_core::{
	Devtools, LOG_CAPACITY, LogEntry, LogFilter, LogOrder, LogView, insert_by_time, sort_by_time,
};

use crate::empty::SETUP_STEPS;
use crate::empty_state::EmptyState;
use crate::mcp_menu::McpButton;
use crate::nav;
use crate::theme;
use crate::widgets::{
	Raised, footer_bar, page_header, page_header_end, raised_button, segmented, tooltip,
};

/// Lines come in batches; one redraw per frame is plenty.
const CHANGE_COALESCING_FRAME: Duration = Duration::from_millis(16);
const SEGMENTS_WIDTH: f32 = 380.;
const ORDER_WIDTH: f32 = 220.;

pub struct LogsPage {
	devtools: Devtools,
	/// Every kept line, oldest first; the core's buffer as far as this page has read it.
	entries: VecDeque<Arc<LogEntry>>,
	/// The newest line read from the core.
	read: u64,
	/// The kept lines the filter shows, sorted by when the device wrote them, oldest first.
	rows: VecDeque<Arc<LogEntry>>,
	filter: LogFilter,
	order: LogOrder,
	/// Whether the debugger connection has a device on it.
	connected: bool,
	scroll: UniformListScrollHandle,
	mcp: Entity<McpButton>,
	_watch: [gpui::Task<()>; 2],
}

impl LogsPage {
	pub fn new(devtools: Devtools, mcp: Entity<McpButton>, cx: &mut Context<Self>) -> Self {
		let lines = cx.spawn({
			let mut changes = devtools.log_changes();
			async move |this, cx| {
				while changes.changed().await.is_ok() {
					changes.borrow_and_update();
					if this.update(cx, |this, cx| this.read_lines(cx)).is_err() {
						break;
					}
					cx.background_executor()
						.timer(CHANGE_COALESCING_FRAME)
						.await;
				}
			}
		});
		let status = cx.spawn({
			let mut changes = devtools.changes();
			async move |this, cx| {
				while changes.changed().await.is_ok() {
					changes.borrow_and_update();
					if this.update(cx, |this, cx| this.status_changed(cx)).is_err() {
						break;
					}
					cx.background_executor()
						.timer(CHANGE_COALESCING_FRAME)
						.await;
				}
			}
		});
		let mut this = Self {
			connected: device_connected(&devtools),
			devtools,
			entries: VecDeque::new(),
			read: 0,
			rows: VecDeque::new(),
			filter: LogFilter::default(),
			order: LogOrder::default(),
			scroll: UniformListScrollHandle::new(),
			mcp,
			_watch: [lines, status],
		};
		this.read_lines(cx);
		this
	}

	fn status_changed(&mut self, cx: &mut Context<Self>) {
		let connected = device_connected(&self.devtools);
		if connected != self.connected {
			self.connected = connected;
			cx.notify();
		}
	}

	/// Takes the lines the core kept since the last read, dropping the oldest past its capacity.
	fn read_lines(&mut self, cx: &mut Context<Self>) {
		let fresh = self.devtools.logs_after(self.read);
		let Some(last) = fresh.last() else {
			return;
		};
		self.read = last.seq;
		// Read before the list grows: a reader scrolled away from the newest line keeps their place.
		let follow = self.at_newest();
		for entry in fresh {
			if self.filter.matches(&entry.line) {
				insert_by_time(&mut self.rows, entry.clone());
			}
			self.entries.push_back(entry);
		}
		let overflow = self.entries.len().saturating_sub(LOG_CAPACITY);
		if overflow > 0 {
			self.entries.drain(..overflow);
			// Rows are in time order, so the dropped ones can sit anywhere among them.
			if let Some(first) = self.entries.front().map(|entry| entry.seq) {
				self.rows.retain(|row| row.seq >= first);
			}
		}
		if follow {
			self.scroll_to_newest();
		}
		cx.notify();
	}

	/// Whether the list sits at its newest end: the bottom oldest first, the top newest first.
	fn at_newest(&self) -> bool {
		match self.order {
			LogOrder::OldestFirst => self.scroll.is_scrolled_to_end().unwrap_or(true),
			LogOrder::NewestFirst => self.scroll.0.borrow().base_handle.offset().y >= px(0.),
		}
	}

	fn scroll_to_newest(&self) {
		match self.order {
			LogOrder::OldestFirst => self.scroll.scroll_to_bottom(),
			LogOrder::NewestFirst => self.scroll.scroll_to_item(0, ScrollStrategy::Top),
		}
	}

	fn set_order(&mut self, order: LogOrder, cx: &mut Context<Self>) {
		if order == self.order {
			return;
		}
		self.order = order;
		self.scroll_to_newest();
		cx.notify();
	}

	fn set_filter(&mut self, filter: LogFilter, cx: &mut Context<Self>) {
		if filter == self.filter {
			return;
		}
		self.filter = filter;
		self.rows = self
			.entries
			.iter()
			.filter(|entry| filter.matches(&entry.line))
			.cloned()
			.collect();
		sort_by_time(&mut self.rows);
		self.scroll_to_newest();
		cx.notify();
	}

	fn clear(&mut self, cx: &mut Context<Self>) {
		self.devtools.clear_logs();
		self.entries.clear();
		self.rows.clear();
		cx.notify();
	}

	fn render_filters(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let views: Vec<String> = LogView::ALL
			.iter()
			.map(|view| view.label().to_owned())
			.collect();
		let selected = LogView::ALL
			.iter()
			.position(|view| *view == self.filter.view);
		let orders: Vec<String> = LogOrder::ALL
			.iter()
			.map(|order| order.label().to_owned())
			.collect();
		let order = LogOrder::ALL.iter().position(|order| *order == self.order);
		div()
			.flex_none()
			.flex()
			.items_center()
			.gap(px(16.))
			.px(px(theme::GUTTER))
			.py(px(8.))
			.border_b_1()
			.border_color(theme::color(theme::BORDER))
			.child(
				segmented(
					"log-view",
					&views,
					selected,
					cx.listener(|this, picked: &usize, _, cx| {
						if let Some(view) = LogView::ALL.get(*picked) {
							let filter = LogFilter {
								view: *view,
								..this.filter
							};
							this.set_filter(filter, cx);
						}
					}),
				)
				.w(px(SEGMENTS_WIDTH)),
			)
			.child(
				Switch::new("log-unbound-only")
					.checked(self.filter.unbound_only)
					.label("Unbound only")
					.on_click(cx.listener(|this, on: &bool, _, cx| {
						let filter = LogFilter {
							unbound_only: *on,
							..this.filter
						};
						this.set_filter(filter, cx);
					})),
			)
			.child(div().flex_1())
			.child(
				segmented(
					"log-order",
					&orders,
					order,
					cx.listener(|this, picked: &usize, _, cx| {
						if let Some(order) = LogOrder::ALL.get(*picked) {
							this.set_order(*order, cx);
						}
					}),
				)
				.w(px(ORDER_WIDTH)),
			)
	}

	fn render_state(&self) -> gpui::AnyElement {
		let (icon, title, body): (_, _, SharedString) = if !self.entries.is_empty() {
			(
				"icons/list-filter.svg",
				"No Matching Lines",
				"No line from this source has come in yet. Pick another source or turn off Unbound only."
					.into(),
			)
		} else if self.connected {
			(
				"icons/scroll-text.svg",
				"Waiting for Logs",
				"A device is connected. Its log lines appear here as it writes them.".into(),
			)
		} else {
			(
				"icons/unplug.svg",
				"No Device Connected",
				SETUP_STEPS.into(),
			)
		};
		EmptyState::new(icon, title).body(body).into_any_element()
	}

	fn render_footer(&self) -> impl IntoElement {
		let count = self.entries.len();
		let note = (count > 0).then(|| {
			let noun = if count == 1 { "line" } else { "lines" };
			format!(
				"{} of {count} {noun} shown. Click a line to copy it.",
				self.rows.len()
			)
		});
		// The MCP button pads its label by 8px, so the bar pads 8px less to end on the gutter.
		footer_bar()
			.pl(px(theme::GUTTER))
			.pr(px(theme::GUTTER - 8.))
			.child(div().flex_1().min_w_0().truncate().children(note))
			.child(self.mcp.clone())
	}
}

fn device_connected(devtools: &Devtools) -> bool {
	devtools
		.status()
		.link
		.is_some_and(|link| link.device.is_some())
}

impl Render for LogsPage {
	fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let any = !self.entries.is_empty();
		let body = if self.rows.is_empty() {
			self.render_state()
		} else {
			self.render_list(cx).into_any_element()
		};
		div()
			.size_full()
			.flex()
			.flex_col()
			.child(
				page_header(nav::COMPONENTS_GROUP, nav::LOGS_TITLE).child(
					page_header_end().justify_end().child(
						raised_button(
							"clear-logs",
							Raised::Secondary,
							Some("icons/trash.svg"),
							"Clear",
							any,
						)
						.tooltip(tooltip("Clear the lines shown here"))
						.when(any, |button| {
							button.on_click(cx.listener(|this, _, _, cx| this.clear(cx)))
						}),
					),
				),
			)
			.child(self.render_filters(cx))
			.child(body)
			.child(self.render_footer())
	}
}
