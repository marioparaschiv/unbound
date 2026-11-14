mod agents;
mod app;
mod appearance;
mod assets;
mod copy_chip;
mod copy_glyph;
mod empty;
mod empty_state;
mod explorer;
mod inspection;
mod inspector;
mod link;
mod mcp_menu;
mod metro;
mod nav;
mod nav_list;
mod pairing;
mod popout;
mod press;
mod scaled;
mod search;
mod settings;
mod settings_dialog;
mod shell;
mod smooth_scroll;
mod status;
mod theme;
mod title_bar;
mod toolbar;
mod tree;
mod update;
mod values;
mod view_finder;
mod widgets;

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::time::Duration;

use clap::{Parser, Subcommand};
use gpui::{
	App, AppContext, Bounds, QuitMode, WindowBounds, WindowDecorations, WindowOptions, px, size,
};
use gpui_component::{Root, TitleBar};
use unbound_devtools_core::bridge::Launcher;
use unbound_devtools_core::{Config, DEFAULT_BRIDGE_PORT, Devtools, bridge_server, mcp};

use crate::settings::Settings;

/// Flags override the settings for this run only.
#[derive(Parser)]
#[command(name = "unbound-devtools", version, about)]
struct Cli {
	/// The Unbound debugger bridge, for "Connect device". Defaults to 127.0.0.1:<bridge port setting>.
	#[arg(long, global = true)]
	bridge: Option<SocketAddr>,
	#[arg(long, global = true, env = "UNBOUND_BRIDGE_PORT", hide = true)]
	bridge_port: Option<u16>,
	/// Port for the MCP endpoint at http://127.0.0.1:<port>/mcp.
	#[arg(long)]
	mcp_port: Option<u16>,
	/// Don't serve MCP over HTTP.
	#[arg(long)]
	no_mcp: bool,
	#[command(subcommand)]
	command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
	/// Serve MCP over stdio with no window.
	Mcp,
	/// Serve the debugger bridge with no window, as "Connect device" starts it when none listens.
	ServeBridge {
		#[arg(long, default_value_t = DEFAULT_BRIDGE_PORT)]
		port: u16,
		/// Seconds to keep running with no controller attached; 0 never exits.
		#[arg(long, default_value_t = 60)]
		idle_timeout: u64,
	},
}

impl Cli {
	fn config(&self, settings: &Settings) -> Config {
		let bridge_port = self.bridge_port.unwrap_or(settings.bridge_port);
		let bridge = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), bridge_port);
		Config {
			bridge: self.bridge.unwrap_or(bridge),
			// This app serves the bridge itself (`serve-bridge`) when none listens.
			bridge_launcher: std::env::current_exe().ok().map(|program| Launcher {
				program: program.to_string_lossy().into_owned(),
				prefix: Vec::new(),
			}),
		}
	}

	fn mcp_port(&self, settings: &Settings) -> Option<u16> {
		let enabled = settings.mcp_enabled && !self.no_mcp;
		enabled.then(|| self.mcp_port.unwrap_or(settings.mcp_port))
	}
}

fn main() -> anyhow::Result<()> {
	let cli = Cli::parse();
	tracing_subscriber::fmt()
		.with_writer(std::io::stderr)
		.with_env_filter(
			tracing_subscriber::EnvFilter::try_from_default_env()
				.unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
		)
		.init();
	update::clean_up();
	let settings = settings::load();
	let config = cli.config(&settings);
	match cli.command {
		Some(Command::ServeBridge { port, idle_timeout }) => {
			let idle_timeout = (idle_timeout > 0).then(|| Duration::from_secs(idle_timeout));

			tokio::runtime::Runtime::new()?.block_on(bridge_server::run(port, idle_timeout))?;
			Ok(())
		}
		Some(Command::Mcp) => {
			let devtools = Devtools::start(config);
			devtools
				.runtime()
				.block_on(mcp::serve_stdio(devtools.clone()))
		}
		None => {
			let mcp_port = cli.mcp_port(&settings);
			run_gui(settings, config, mcp_port);
			Ok(())
		}
	}
}

const MCP_BIND_ATTEMPTS: u32 = 8;

fn serve_mcp(devtools: &Devtools, port: u16) {
	let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
	devtools.set_mcp_url(Some(format!("http://{addr}/mcp")));
	let server = devtools.clone();
	devtools.runtime().spawn(async move {
		// After an update restart, the old process may hold the port for a moment while it quits.
		for attempt in 1.. {
			match mcp::serve_http(server.clone(), addr).await {
				Ok(_) => return,
				Err(_) if attempt < MCP_BIND_ATTEMPTS => {
					tokio::time::sleep(Duration::from_millis(250)).await;
				}
				Err(error) => {
					tracing::error!("MCP server on {addr} stopped: {error:#}");
					server.set_mcp_url(None);
					return;
				}
			}
		}
	});
}

fn run_gui(settings: Settings, config: Config, mcp_port: Option<u16>) {
	let devtools = Devtools::start(config);
	// Discord dials the bridge, not this app, so the app always watches this machine's bridge;
	// `--bridge` points it elsewhere.
	devtools.link_to(devtools.default_target(), None);
	if let Some(port) = mcp_port {
		serve_mcp(&devtools, port);
	}
	gpui_platform::application()
		.with_assets(assets::Assets)
		.with_quit_mode(QuitMode::LastWindowClosed)
		.run(move |cx: &mut App| {
			if let Err(error) = assets::load_fonts(cx) {
				tracing::error!("Could not load the bundled fonts: {error:#}");
			}
			settings::init(settings, cx);
			update::init(cx);
			appearance::init(cx);
			appearance::apply(None, cx);
			app::bind_keys(cx);
			shell::bind_keys(cx);
			let bounds = Bounds::centered(None, size(px(1360.), px(860.)), cx);
			// The shell draws its own title bar (`title_bar.rs`), so the system's is hidden: macOS keeps
			// its traffic lights over the bar, and Linux and Windows get client-side decorations.
			let options = WindowOptions {
				window_bounds: Some(WindowBounds::Windowed(bounds)),
				titlebar: Some(title_bar::titlebar_options("Unbound DevTools")),
				window_decorations: Some(WindowDecorations::Client),
				window_min_size: Some(size(px(1040.), px(620.))),
				app_id: Some("unbound-devtools".into()),
				..TitleBar::window_options()
			};
			let opened = cx.open_window(options, |window, cx| {
				appearance::apply(Some(window), cx);
				let link = cx.new(|cx| link::DebuggerLink::new(devtools.clone(), cx));
				let mcp = cx.new(|cx| mcp_menu::McpButton::new(devtools.clone(), cx));
				let workspace =
					cx.new(|cx| app::Workspace::new(devtools.clone(), mcp.clone(), window, cx));
				let shell =
					cx.new(|cx| shell::Shell::new(devtools, workspace, link, mcp, window, cx));
				cx.new(|cx| Root::new(shell, window, cx))
			});
			if let Err(error) = opened {
				tracing::error!("Could not open the window: {error:#}");
				cx.quit();
				return;
			}
			cx.activate(true);
			if settings::get(cx).check_for_updates {
				update::check(true, cx);
			}
		});
}
