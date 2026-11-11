use gpui::{App, AppContext, Context, Entity, FocusHandle, Focusable, KeyBinding, Window, actions};
use unbound_devtools_core::{DevicePreset, Presets};

use crate::link::DebuggerLink;
use gpui_component::input::InputState;

actions!(
	device_menu,
	[
		MenuUp,
		MenuDown,
		MenuConfirm,
		MenuDismiss,
		FormNext,
		FormPrev
	]
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DeviceChoice {
	Default,
	Preset(String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MenuItem {
	Preset(String),
	Default,
	SavePreset,
	Disconnect,
}

pub struct PresetForm {
	pub name: Entity<InputState>,
	pub bridge: Entity<InputState>,
	pub host: Entity<InputState>,
	pub error: Option<String>,
}

impl PresetForm {
	fn fields(&self) -> [&Entity<InputState>; 3] {
		[&self.name, &self.bridge, &self.host]
	}
}

pub struct DeviceMenu {
	pub focus: FocusHandle,
	/// What had focus before the menu opened, so closing it hands focus back.
	pub restore: Option<FocusHandle>,
	pub highlighted: usize,
	pub form: Option<PresetForm>,
}

/// The saved devices, this machine, then the actions; `Disconnect` only while a link is on.
pub fn menu_items(presets: &Result<Presets, String>, linked: bool) -> Vec<MenuItem> {
	let saved = presets.iter().flat_map(|presets| &presets.devices);
	saved
		.map(|preset| MenuItem::Preset(preset.name.clone()))
		.chain([MenuItem::Default, MenuItem::SavePreset])
		.chain(linked.then_some(MenuItem::Disconnect))
		.collect()
}

impl DebuggerLink {
	pub fn reload_presets(&mut self) {
		self.presets_revision = self.devtools.presets_revision();
		self.presets = self.devtools.presets().map_err(|error| error.to_string());
	}

	pub fn items(&self) -> Vec<MenuItem> {
		menu_items(&self.presets, self.status.link.is_some())
	}

	/// The device the link dials, or the one it last dialled.
	pub fn current_choice(&self) -> DeviceChoice {
		if let Some(link) = &self.status.link {
			return match &link.name {
				Some(name) => DeviceChoice::Preset(name.clone()),
				None => DeviceChoice::Default,
			};
		}
		match self.presets.as_ref().ok().and_then(Presets::last_used) {
			Some(preset) => DeviceChoice::Preset(preset.name.clone()),
			None => DeviceChoice::Default,
		}
	}

	/// Makes `choice` the debugger connection. `false`, with the reason in the menu, on failure.
	pub fn connect(&mut self, choice: DeviceChoice, cx: &mut Context<Self>) -> bool {
		let preset = match &choice {
			DeviceChoice::Preset(name) => Some(name.as_str()),
			DeviceChoice::Default => None,
		};
		let connected = self.devtools.connect_link(preset);
		self.error = connected
			.as_ref()
			.err()
			.map(|error| format!("Failed to connect: {error}"));
		cx.notify();
		connected.is_ok()
	}

	pub fn toggle_device_menu(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		if self.device_menu.is_some() {
			self.close_device_menu(window, cx);
			return;
		}
		self.reload_presets();
		let current = match self.current_choice() {
			DeviceChoice::Preset(name) => MenuItem::Preset(name),
			DeviceChoice::Default => MenuItem::Default,
		};
		let highlighted = self
			.items()
			.iter()
			.position(|item| *item == current)
			.unwrap_or(0);
		let restore = window.focused(cx);
		let focus = cx.focus_handle();
		window.focus(&focus, cx);
		self.device_menu = Some(DeviceMenu {
			focus,
			restore,
			highlighted,
			form: None,
		});
		cx.notify();
	}

	pub fn close_device_menu(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		if let Some(restore) = self.device_menu.take().and_then(|menu| menu.restore) {
			window.focus(&restore, cx);
		}
		cx.notify();
	}

	pub fn activate_menu_item(
		&mut self,
		item: MenuItem,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		let choice = match item {
			MenuItem::Preset(name) => DeviceChoice::Preset(name),
			MenuItem::Default => DeviceChoice::Default,
			MenuItem::SavePreset => {
				self.open_preset_form(window, cx);
				return;
			}
			MenuItem::Disconnect => {
				self.devtools.disconnect_link();
				self.error = None;
				self.close_device_menu(window, cx);
				return;
			}
		};
		if self.connect(choice, cx) {
			self.close_device_menu(window, cx);
		}
	}

	pub fn open_preset_form(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		let bridge_hint = self.default_target_hint();
		let form = PresetForm {
			name: cx.new(|cx| InputState::new(window, cx).placeholder("iPhone VM")),
			bridge: cx.new(|cx| InputState::new(window, cx).placeholder(bridge_hint)),
			host: cx.new(|cx| InputState::new(window, cx).placeholder("Read from the device")),
			error: None,
		};
		window.focus(&form.name.focus_handle(cx), cx);
		if let Some(menu) = self.device_menu.as_mut() {
			menu.form = Some(form);
		}
		cx.notify();
	}

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
		let Some(form) = self
			.device_menu
			.as_mut()
			.and_then(|menu| menu.form.as_mut())
		else {
			return;
		};
		let [name, bridge, host] = form
			.fields()
			.map(|field| field.read(cx).value().to_string());
		let saved = DevicePreset::parse(&name, &bridge, &host)
			.and_then(|preset| {
				let name = preset.name.clone();
				self.devtools.save_preset(preset).map(|()| name)
			})
			.map_err(|error| error.to_string());
		let name = match saved {
			Ok(name) => name,
			Err(error) => {
				if let Some(form) = self
					.device_menu
					.as_mut()
					.and_then(|menu| menu.form.as_mut())
				{
					form.error = Some(error);
				}
				cx.notify();
				return;
			}
		};
		self.reload_presets();
		let item = MenuItem::Preset(name);
		let highlighted = self
			.items()
			.iter()
			.position(|candidate| *candidate == item)
			.unwrap_or(0);
		if let Some(menu) = self.device_menu.as_mut() {
			menu.highlighted = highlighted;
		}
		self.close_preset_form(window, cx);
	}

	pub fn remove_preset(&mut self, name: &str, cx: &mut Context<Self>) {
		self.error = self
			.devtools
			.remove_preset(name)
			.err()
			.map(|error| format!("Failed to remove {name}: {error}"));
		self.reload_presets();
		// Removing the linked device drops the link, and with it the Disconnect row.
		self.status = self.devtools.status();
		let count = self.items().len();
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
		let count = self.items().len();
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
		if let Some(item) = self.items().get(menu.highlighted).cloned() {
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
		let Some(form) = self
			.device_menu
			.as_ref()
			.and_then(|menu| menu.form.as_ref())
		else {
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
