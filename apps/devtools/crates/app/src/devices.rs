//! The "Connect device" split button's state: which device the main part dials, the dropdown's
//! items and highlight, and the inline "Save as preset" form.

use gpui::{App, AppContext, Context, Entity, FocusHandle, Focusable, KeyBinding, Window, actions};
use unbound_devtools_core::{DevicePreset, Presets};

use crate::app::{Workspace, on_runtime};
use crate::input::TextInput;

actions!(
	device_menu,
	[MenuUp, MenuDown, MenuConfirm, MenuDismiss, FormNext, FormPrev]
);

pub const MENU_CONTEXT: &str = "DeviceMenu";
pub const FORM_CONTEXT: &str = "PresetForm";

pub fn bind_keys(cx: &mut App) {
	let menu = Some(MENU_CONTEXT);
	let form = Some(FORM_CONTEXT);
	cx.bind_keys([
		KeyBinding::new("up", MenuUp, menu),
		KeyBinding::new("down", MenuDown, menu),
		KeyBinding::new("enter", MenuConfirm, menu),
		KeyBinding::new("escape", MenuDismiss, menu),
		KeyBinding::new("tab", FormNext, form),
		KeyBinding::new("shift-tab", FormPrev, form),
	]);
}

/// What a connect dials: the command line's bridge, or a saved device by name.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DeviceChoice {
	Default,
	Preset(String),
}

/// One selectable line of the menu, in display order.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MenuItem {
	Preset(String),
	Default,
	SavePreset,
}

pub struct PresetForm {
	pub name: Entity<TextInput>,
	pub bridge: Entity<TextInput>,
	pub host: Entity<TextInput>,
	pub error: Option<String>,
}

impl PresetForm {
	fn fields(&self) -> [&Entity<TextInput>; 3] {
		[&self.name, &self.bridge, &self.host]
	}
}

pub struct DeviceMenu {
	pub focus: FocusHandle,
	pub highlighted: usize,
	pub form: Option<PresetForm>,
}

/// The menu's items for `presets`; an unreadable file still offers the default.
pub fn menu_items(presets: &Result<Presets, String>) -> Vec<MenuItem> {
	let saved = presets.iter().flat_map(|presets| &presets.devices);
	saved
		.map(|preset| MenuItem::Preset(preset.name.clone()))
		.chain([MenuItem::Default, MenuItem::SavePreset])
		.collect()
}

impl Workspace {
	pub fn reload_presets(&mut self) {
		self.presets_revision = self.devtools.presets_revision();
		self.presets = self.devtools.presets().map_err(|error| error.to_string());
	}

	/// The main button's target: the last preset connected, while it still exists.
	pub fn default_choice(&self) -> DeviceChoice {
		match self.presets.as_ref().ok().and_then(Presets::last_used) {
			Some(preset) => DeviceChoice::Preset(preset.name.clone()),
			None => DeviceChoice::Default,
		}
	}

	pub fn connect(&mut self, choice: DeviceChoice, cx: &mut Context<Self>) {
		if self.connecting {
			return;
		}
		self.connecting = true;
		let devtools = self.devtools.clone();
		let request = on_runtime(&self.devtools, async move {
			match choice {
				DeviceChoice::Default => devtools.connect_device().await,
				DeviceChoice::Preset(name) => devtools.connect_preset(&name).await,
			}
		});
		cx.spawn(async move |this, cx| {
			let result = request.await;
			this.update(cx, |this, cx| {
				this.connecting = false;
				match result {
					Some(Ok(_)) => cx.notify(),
					Some(Err(error)) => this.show_error(format!("Connect device: {error:#}"), cx),
					None => this.show_error("Connect device was cancelled.".into(), cx),
				}
			})
			.ok();
		})
		.detach();
		cx.notify();
	}

	pub fn toggle_device_menu(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		if self.device_menu.is_some() {
			self.close_device_menu(window, cx);
			return;
		}
		self.reload_presets();
		let highlighted = match self.default_choice() {
			DeviceChoice::Preset(name) => menu_items(&self.presets)
				.iter()
				.position(|item| *item == MenuItem::Preset(name.clone()))
				.unwrap_or(0),
			DeviceChoice::Default => menu_items(&self.presets)
				.iter()
				.position(|item| *item == MenuItem::Default)
				.unwrap_or(0),
		};
		let focus = cx.focus_handle();
		window.focus(&focus, cx);
		self.device_menu = Some(DeviceMenu {
			focus,
			highlighted,
			form: None,
		});
		cx.notify();
	}

	pub fn close_device_menu(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		self.device_menu = None;
		window.focus(&self.tree_focus, cx);
		cx.notify();
	}

	pub fn activate_menu_item(&mut self, item: MenuItem, window: &mut Window, cx: &mut Context<Self>) {
		let choice = match item {
			MenuItem::Preset(name) => DeviceChoice::Preset(name),
			MenuItem::Default => DeviceChoice::Default,
			MenuItem::SavePreset => {
				self.open_preset_form(window, cx);
				return;
			}
		};
		self.close_device_menu(window, cx);
		self.connect(choice, cx);
	}

	pub fn open_preset_form(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		let bridge_hint = self.default_target_hint();
		let form = PresetForm {
			name: cx.new(|cx| TextInput::new("iPhone VM", cx)),
			bridge: cx.new(|cx| TextInput::new(bridge_hint, cx)),
			host: cx.new(|cx| TextInput::new("Read from the device", cx)),
			error: None,
		};
		window.focus(&form.name.focus_handle(cx), cx);
		if let Some(menu) = self.device_menu.as_mut() {
			menu.form = Some(form);
		}
		cx.notify();
	}

	/// The bridge the main button would dial, as the bridge field's placeholder.
	fn default_target_hint(&self) -> String {
		let preset = self.presets.as_ref().ok().and_then(Presets::last_used);
		match preset {
			Some(preset) => preset.bridge.to_string(),
			None => self.devtools.default_target().bridge.to_string(),
		}
	}

	fn close_preset_form(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		let Some(menu) = self.device_menu.as_mut() else {
			return;
		};
		menu.form = None;
		window.focus(&menu.focus, cx);
		cx.notify();
	}

	pub fn submit_preset_form(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		let Some(form) = self.device_menu.as_mut().and_then(|menu| menu.form.as_mut()) else {
			return;
		};
		let [name, bridge, host] = form.fields().map(|field| field.read(cx).text().to_owned());
		let saved = DevicePreset::parse(&name, &bridge, &host)
			.and_then(|preset| {
				let name = preset.name.clone();
				self.devtools.save_preset(preset).map(|()| name)
			})
			.map_err(|error| error.to_string());
		let name = match saved {
			Ok(name) => name,
			Err(error) => {
				if let Some(form) = self.device_menu.as_mut().and_then(|menu| menu.form.as_mut()) {
					form.error = Some(error);
				}
				cx.notify();
				return;
			}
		};
		self.reload_presets();
		let item = MenuItem::Preset(name);
		if let Some(menu) = self.device_menu.as_mut() {
			menu.highlighted = menu_items(&self.presets)
				.iter()
				.position(|candidate| *candidate == item)
				.unwrap_or(0);
		}
		self.close_preset_form(window, cx);
	}

	pub fn remove_preset(&mut self, name: &str, cx: &mut Context<Self>) {
		if let Err(error) = self.devtools.remove_preset(name) {
			self.show_error(format!("Remove {name}: {error}"), cx);
		}
		self.reload_presets();
		let count = menu_items(&self.presets).len();
		if let Some(menu) = self.device_menu.as_mut() {
			menu.highlighted = menu.highlighted.min(count - 1);
		}
		cx.notify();
	}

	pub fn menu_up(&mut self, _: &MenuUp, _: &mut Window, cx: &mut Context<Self>) {
		self.move_highlight(-1, cx);
	}

	pub fn menu_down(&mut self, _: &MenuDown, _: &mut Window, cx: &mut Context<Self>) {
		self.move_highlight(1, cx);
	}

	fn move_highlight(&mut self, step: isize, cx: &mut Context<Self>) {
		let count = menu_items(&self.presets).len();
		let Some(menu) = self.device_menu.as_mut().filter(|menu| menu.form.is_none()) else {
			return;
		};
		menu.highlighted = menu.highlighted.saturating_add_signed(step).min(count - 1);
		cx.notify();
	}

	pub fn menu_confirm(&mut self, _: &MenuConfirm, window: &mut Window, cx: &mut Context<Self>) {
		let Some(menu) = self.device_menu.as_ref() else {
			return;
		};
		if menu.form.is_some() {
			self.submit_preset_form(window, cx);
			return;
		}
		if let Some(item) = menu_items(&self.presets).get(menu.highlighted).cloned() {
			self.activate_menu_item(item, window, cx);
		}
	}

	pub fn menu_dismiss(&mut self, _: &MenuDismiss, window: &mut Window, cx: &mut Context<Self>) {
		let in_form = self
			.device_menu
			.as_ref()
			.is_some_and(|menu| menu.form.is_some());
		if in_form {
			self.close_preset_form(window, cx);
		} else {
			self.close_device_menu(window, cx);
		}
	}

	pub fn form_next(&mut self, _: &FormNext, window: &mut Window, cx: &mut Context<Self>) {
		self.cycle_field(1, window, cx);
	}

	pub fn form_prev(&mut self, _: &FormPrev, window: &mut Window, cx: &mut Context<Self>) {
		self.cycle_field(2, window, cx);
	}

	fn cycle_field(&mut self, step: usize, window: &mut Window, cx: &mut Context<Self>) {
		let Some(form) = self.device_menu.as_ref().and_then(|menu| menu.form.as_ref()) else {
			return;
		};
		let fields = form.fields();
		let current = fields
			.iter()
			.position(|field| field.focus_handle(cx).is_focused(window))
			.unwrap_or(0);
		let next = fields[(current + step) % fields.len()].focus_handle(cx);
		window.focus(&next, cx);
	}
}
