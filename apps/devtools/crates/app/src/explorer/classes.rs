//! The Classes page: the runtime's classes beside an explorer page for the one picked. On iOS it
//! lists the loaded images, then an image's classes, a page at a time and filtered on the device. On
//! Android, which cannot list its dex files, a class opens by name and stays in a recent list.

use std::rc::Rc;
use std::time::Duration;

use gpui::{
	AnyElement, AppContext, Context, Entity, FontWeight, SharedString, Task,
	UniformListScrollHandle, Window, div, prelude::*, px, uniform_list,
};
use gpui_component::input::{Input, InputEvent, InputState};
use unbound_devtools_core::{
	ClassesPage, Devtools, EXPLORER_CLASSES_PAGE_SIZE, ExplorerError, ExplorerImage,
	ExplorerPlatform, ExplorerTarget,
};

use super::render::link_button;
use super::{Entry, Explorer, ExplorerHost, FILTER_DEBOUNCE};
use crate::app::on_runtime;
use crate::commands::nav;
use crate::empty::SETUP_STEPS;
use crate::empty_state::EmptyState;
use crate::smooth_scroll::SmoothScroll;
use crate::theme;
use crate::widgets::{
	badge, field, footer_bar, icon, icon_button, page_header, panel_header, tooltip,
};

const CHANGE_COALESCING_FRAME: Duration = Duration::from_millis(16);
const RECENT_LIMIT: usize = 30;
const EXPLORER_WIDTH: f32 = 560.;

/// The images or one image's classes, as far as the device has answered.
struct Listing {
	images: Vec<ExplorerImage>,
	classes: Vec<String>,
	total: u32,
	/// The first page failed.
	error: Option<ExplorerError>,
	/// The next page, while it loads (`Ok`) or after it failed.
	next: Option<Result<(), ExplorerError>>,
	loading: bool,
}

#[derive(Clone)]
enum Row {
	Image(usize),
	Class(usize),
	Recent(usize),
	Note(SharedString, bool),
	More,
}

pub struct ClassBrowser {
	devtools: Devtools,
	explorer: Explorer,
	connected: bool,
	platform: Option<ExplorerPlatform>,
	opened: bool,
	search: Entity<InputState>,
	/// The filter the listing was asked with, once typing paused.
	query: String,
	/// The image whose classes are listed; `None` lists the images.
	image: Option<ExplorerImage>,
	listing: Option<Listing>,
	/// Classes opened by name on Android, newest first.
	recent: Vec<String>,
	rows: Rc<Vec<Row>>,
	scroll: UniformListScrollHandle,
	epoch: u64,
	search_task: Option<Task<()>>,
	_watch: Task<()>,
}

fn device_platform(devtools: &Devtools) -> Option<ExplorerPlatform> {
	let device = devtools.status().link?.device?;
	Some(if device.platform == "android" {
		ExplorerPlatform::Android
	} else {
		ExplorerPlatform::Ios
	})
}

impl ClassBrowser {
	pub fn new(devtools: Devtools, window: &mut Window, cx: &mut Context<Self>) -> Self {
		let search = cx.new(|cx| InputState::new(window, cx));
		cx.subscribe(&search, |this, _, event: &InputEvent, cx| match event {
			InputEvent::Change => this.search_typed(cx),
			InputEvent::PressEnter { .. } => this.open_typed(cx),
			_ => {}
		})
		.detach();
		let watch = cx.spawn({
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
		let mut explorer = Explorer::new(devtools.clone(), window, cx);
		let platform = device_platform(&devtools);
		explorer.set_connected(platform.is_some(), cx);
		let this = Self {
			connected: platform.is_some(),
			platform,
			devtools,
			explorer,
			opened: false,
			search,
			query: String::new(),
			image: None,
			listing: None,
			recent: Vec::new(),
			rows: Rc::default(),
			scroll: UniformListScrollHandle::new(),
			epoch: 0,
			search_task: None,
			_watch: watch,
		};
		this.update_placeholder(window, cx);
		this
	}

	/// Lists the images the first time the page shows.
	pub fn open(&mut self, cx: &mut Context<Self>) {
		self.opened = true;
		if self.connected && self.listing.is_none() {
			self.list(0, cx);
		}
	}

	fn status_changed(&mut self, cx: &mut Context<Self>) {
		let platform = device_platform(&self.devtools);
		let connected = platform.is_some();
		if connected == self.connected && platform == self.platform {
			return;
		}
		self.connected = connected;
		self.platform = platform;
		self.explorer.set_connected(connected, cx);
		self.listing = None;
		self.epoch += 1;
		if connected && self.opened {
			self.list(0, cx);
		}
		self.rebuild_rows();
		cx.notify();
	}

	fn update_placeholder(&self, window: &mut Window, cx: &mut Context<Self>) {
		let text = match (self.platform, &self.image) {
			(Some(ExplorerPlatform::Android), _) => {
				"Open a class by name, such as android.widget.TextView"
			}
			(_, Some(_)) => "Filter classes, or Enter to open one by name",
			_ => "Filter images, or Enter to open a class by name",
		};
		self.search
			.update(cx, |search, cx| search.set_placeholder(text, window, cx));
	}

	fn search_typed(&mut self, cx: &mut Context<Self>) {
		if self.platform == Some(ExplorerPlatform::Android) {
			return;
		}
		let text = self.search.read(cx).value().trim().to_owned();
		self.search_task = Some(cx.spawn(async move |this, cx| {
			cx.background_executor().timer(FILTER_DEBOUNCE).await;
			this.update(cx, |this, cx| {
				if this.query != text {
					this.query = text;
					this.list(0, cx);
				}
			})
			.ok();
		}));
	}

	fn open_typed(&mut self, cx: &mut Context<Self>) {
		let name = self.search.read(cx).value().trim().to_owned();
		if !name.is_empty() {
			self.open_class(name, cx);
		}
	}

	fn open_class(&mut self, name: String, cx: &mut Context<Self>) {
		self.recent.retain(|recent| *recent != name);
		self.recent.insert(0, name.clone());
		self.recent.truncate(RECENT_LIMIT);
		self.explorer.reset(Entry::class(name), cx);
		self.rebuild_rows();
		cx.notify();
	}

	fn open_image(
		&mut self,
		image: Option<ExplorerImage>,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		self.image = image;
		self.query.clear();
		self.search
			.update(cx, |search, cx| search.set_value("", window, cx));
		self.update_placeholder(window, cx);
		self.list(0, cx);
	}

	/// Lists a page of images or classes from `offset`; `0` starts the listing over.
	fn list(&mut self, offset: u32, cx: &mut Context<Self>) {
		if self.platform != Some(ExplorerPlatform::Ios) {
			self.rebuild_rows();
			return;
		}
		if offset == 0 {
			self.epoch += 1;
			self.listing = Some(Listing {
				images: Vec::new(),
				classes: Vec::new(),
				total: 0,
				error: None,
				next: None,
				loading: true,
			});
		} else if let Some(listing) = &mut self.listing {
			listing.next = Some(Ok(()));
		}
		let epoch = self.epoch;
		let image = self.image.as_ref().map(|image| image.path.clone());
		let query = self.query.clone();
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			async move {
				devtools
					.explorer_classes(image.as_deref(), &query, offset)
					.await
			}
		});
		cx.spawn(async move |this, cx| {
			let result = request.await;
			this.update(cx, |this, cx| {
				if this.epoch == epoch {
					this.settle(result, cx);
				}
			})
			.ok();
		})
		.detach();
		self.rebuild_rows();
		cx.notify();
	}

	fn settle(
		&mut self,
		result: Option<Result<ClassesPage, ExplorerError>>,
		cx: &mut Context<Self>,
	) {
		let Some(listing) = &mut self.listing else {
			return;
		};
		let result = result.unwrap_or_else(|| {
			Err(ExplorerError::Device {
				code: unbound_devtools_core::ExplorerErrorCode::Failed,
				message: "Listing was cancelled.".into(),
			})
		});
		match result {
			Ok(page) => {
				listing.images.extend(page.images);
				listing.classes.extend(page.classes);
				listing.total = page.total;
				listing.next = None;
			}
			Err(error) if listing.loading => {
				tracing::warn!("Failed to list the classes: {error}");
				listing.error = Some(error);
			}
			Err(error) => listing.next = Some(Err(error)),
		}
		listing.loading = false;
		self.rebuild_rows();
		cx.notify();
	}

	fn rebuild_rows(&mut self) {
		let mut rows = Vec::new();
		match (self.platform, &self.listing) {
			(Some(ExplorerPlatform::Android), _) => {
				rows.extend((0..self.recent.len()).map(Row::Recent));
				if rows.is_empty() {
					rows.push(Row::Note(
						"Type a class's full name and press Enter.".into(),
						false,
					));
				}
			}
			(_, Some(listing)) if listing.loading => rows.push(Row::Note("Loading".into(), false)),
			(
				_,
				Some(Listing {
					error: Some(error), ..
				}),
			) => rows.push(Row::Note(error.to_string().into(), true)),
			(_, Some(listing)) => {
				rows.extend((0..listing.images.len()).map(Row::Image));
				rows.extend((0..listing.classes.len()).map(Row::Class));
				let listed = (listing.images.len() + listing.classes.len()) as u32;
				if listed < listing.total || listing.next.is_some() {
					rows.push(Row::More);
				}
				if listed == 0 {
					rows.push(Row::Note("Nothing matches.".into(), false));
				}
			}
			_ => {}
		}
		self.rows = Rc::new(rows);
	}

	fn current_class(&self) -> Option<&str> {
		match &self.explorer.history.current()?.target {
			ExplorerTarget::ClassName(name) => Some(name),
			_ => None,
		}
	}

	fn render_row(&self, ix: usize, cx: &mut Context<Self>) -> Option<AnyElement> {
		let row = div()
			.id(("class-row", ix))
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
			Row::Image(index) => {
				let image = listing?.images.get(index)?.clone();
				clickable(row)
					.child(icon("icons/package.svg", theme::ICON, theme::TEXT_MUTED))
					.child(
						div()
							.min_w_0()
							.truncate()
							.text_color(theme::color(theme::SYN_COMPONENT))
							.child(image.name.clone()),
					)
					.child(div().flex_1())
					.child(badge(image.class_count.to_string(), theme::TEXT_MUTED))
					.on_click(cx.listener(move |this, _, window, cx| {
						this.open_image(Some(image.clone()), window, cx)
					}))
			}
			Row::Class(index) => {
				self.class_row(clickable(row), listing?.classes.get(index)?.clone(), cx)
			}
			Row::Recent(index) => {
				self.class_row(clickable(row), self.recent.get(index)?.clone(), cx)
			}
			Row::Note(text, error) => row
				.font_family(theme::ui_font())
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(if error {
					theme::ERROR
				} else {
					theme::TEXT_FAINT
				}))
				.child(div().min_w_0().truncate().child(text))
				.when(error, |row| {
					row.child(
						link_button("classes-retry", "Retry")
							.on_click(cx.listener(|this, _, _, cx| this.list(0, cx))),
					)
				}),
			Row::More => {
				let listing = listing?;
				let listed = (listing.images.len() + listing.classes.len()) as u32;
				let remaining = listing.total.saturating_sub(listed);
				let (text, loading) = match &listing.next {
					Some(Ok(())) => ("Loading".to_owned(), true),
					Some(Err(error)) => (format!("{error} Click to try again."), false),
					None => (
						format!(
							"Show {} more · {remaining} not listed",
							remaining.min(EXPLORER_CLASSES_PAGE_SIZE)
						),
						false,
					),
				};
				row.font_family(theme::ui_font())
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
		Some(div().w_full().px(px(4.)).child(element).into_any_element())
	}

	fn class_row(
		&self,
		row: gpui::Stateful<gpui::Div>,
		name: String,
		cx: &mut Context<Self>,
	) -> gpui::Stateful<gpui::Div> {
		let selected = self.current_class() == Some(name.as_str());
		row.when(selected, |row| row.bg(theme::accent_soft()))
			.child(
				div()
					.min_w_0()
					.truncate()
					.text_color(theme::color(theme::SYN_COMPONENT))
					.child(name.clone()),
			)
			.on_click(cx.listener(move |this, _, _, cx| this.open_class(name.clone(), cx)))
	}

	fn render_list(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let title: SharedString = match (&self.image, self.platform) {
			(_, Some(ExplorerPlatform::Android)) => "Recent Classes".into(),
			(Some(image), _) => image.name.clone().into(),
			(None, _) => "Images".into(),
		};
		let list = uniform_list(
			"classes",
			self.rows.len(),
			cx.processor(|this, range: std::ops::Range<usize>, _, cx| {
				range
					.filter_map(|ix| this.render_row(ix, cx))
					.collect::<Vec<_>>()
			}),
		)
		.track_scroll(&self.scroll)
		.flex_1()
		.py(px(4.));
		div()
			.flex_1()
			.min_w_0()
			.h_full()
			.flex()
			.flex_col()
			.child(
				panel_header()
					.when(self.image.is_some(), |header| {
						header.pl(px(6.)).child(
							icon_button("classes-images", "icons/arrow-left.svg", false)
								.tooltip(tooltip("All images"))
								.on_click(cx.listener(|this, _, window, cx| {
									this.open_image(None, window, cx)
								})),
						)
					})
					.child(
						div()
							.flex_1()
							.min_w_0()
							.truncate()
							.font_weight(FontWeight::MEDIUM)
							.text_color(theme::color(theme::TEXT_SECONDARY))
							.child(title),
					)
					.children(self.image.as_ref().map(|image| {
						div()
							.flex_none()
							.max_w(px(260.))
							.truncate()
							.text_size(theme::TEXT_EYEBROW)
							.text_color(theme::color(theme::TEXT_FAINT))
							.child(image.path.clone())
					})),
			)
			.child(
				div().flex_none().px(px(10.)).py(px(8.)).child(field(
					Input::new(&self.search)
						.prefix(icon(crate::assets::SEARCH, theme::ICON, theme::TEXT_MUTED))
						.cleanable(true),
				)),
			)
			.child(
				div()
					.flex_1()
					.min_h_0()
					.flex()
					.flex_col()
					.child(SmoothScroll::new("classes-glide", &self.scroll, list)),
			)
	}
}

impl ExplorerHost for ClassBrowser {
	fn explorer(&self) -> &Explorer {
		&self.explorer
	}

	fn explorer_mut(&mut self) -> &mut Explorer {
		&mut self.explorer
	}
}

impl Render for ClassBrowser {
	fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let body = if self.connected {
			let pane = div()
				.w(px(EXPLORER_WIDTH))
				.flex_none()
				.h_full()
				.flex()
				.flex_col()
				.bg(theme::color(theme::PANEL));
			let pane = if self.explorer.is_open() {
				pane.child(self.explorer.render(cx)).into_any_element()
			} else {
				pane.child(
					div()
						.flex_1()
						.flex()
						.items_center()
						.justify_center()
						.text_color(theme::color(theme::TEXT_MUTED))
						.child("Pick a Class"),
				)
				.into_any_element()
			};
			div()
				.flex_1()
				.min_h_0()
				.flex()
				.child(self.render_list(cx))
				.child(div().flex_none().w(px(1.)).bg(theme::color(theme::BORDER)))
				.child(pane)
				.into_any_element()
		} else {
			EmptyState::new("icons/unplug.svg", "No Device Connected")
				.body(SETUP_STEPS)
				.into_any_element()
		};
		let note = match self.platform {
			Some(ExplorerPlatform::Ios) => "Images and classes come from the Objective-C runtime.",
			Some(ExplorerPlatform::Android) => "Classes open by name through Java reflection.",
			None => "",
		};
		div()
			.size_full()
			.flex()
			.flex_col()
			.child(page_header(nav::COMPONENTS_GROUP, nav::CLASSES_TITLE))
			.child(body)
			.child(
				footer_bar()
					.px(px(theme::GUTTER))
					.child(div().min_w_0().truncate().child(note)),
			)
	}
}
