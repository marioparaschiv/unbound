mod app;
mod assets;
mod device_menu;
mod devices;
mod empty;
mod input;
mod inspection;
mod inspector;
mod search;
mod status;
mod theme;
mod toolbar;
mod tree;
mod values;
mod widgets;

use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use clap::{Parser, Subcommand};
use gpui::{
	App, AppContext, Bounds, QuitMode, TitlebarOptions, WindowBounds, WindowOptions, px, size,
};
use unbound_devtools_core::{
	Config, DEFAULT_BRIDGE_PORT, DEFAULT_DEVTOOLS_PORT, DEFAULT_MCP_PORT, Devtools, mcp,
};

#[derive(Parser)]
#[command(name = "unbound-devtools", version, about)]
struct Cli {
	/// Port the device's DevTools backend dials.
	#[arg(long, global = true, env = "UNBOUND_DEVTOOLS_PORT", default_value_t = DEFAULT_DEVTOOLS_PORT)]
	port: u16,
	/// Address to listen on for the device.
	#[arg(long, global = true, default_value_t = IpAddr::V4(Ipv4Addr::UNSPECIFIED))]
	bind: IpAddr,
	/// The Unbound debugger bridge, for "Connect device". Defaults to 127.0.0.1:<bridge-port>.
	#[arg(long, global = true)]
	bridge: Option<SocketAddr>,
	#[arg(long, global = true, env = "UNBOUND_BRIDGE_PORT", default_value_t = DEFAULT_BRIDGE_PORT, hide = true)]
	bridge_port: u16,
	/// Host the device should dial; defaults to the host in the device's debugger settings.
	#[arg(long, global = true)]
	advertise_host: Option<String>,
	/// Port for the MCP endpoint at http://127.0.0.1:<port>/mcp.
	#[arg(long, default_value_t = DEFAULT_MCP_PORT)]
	mcp_port: u16,
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
}

impl Cli {
	fn config(&self) -> Config {
		let bridge = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), self.bridge_port);
		Config {
			listen: SocketAddr::new(self.bind, self.port),
			bridge: self.bridge.unwrap_or(bridge),
			advertise_host: self.advertise_host.clone(),
		}
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
	let config = cli.config();
	match cli.command {
		Some(Command::Mcp) => {
			let devtools = Devtools::start(config);
			devtools
				.runtime()
				.block_on(mcp::serve_stdio(devtools.clone()))
		}
		None => {
			run_gui(config, (!cli.no_mcp).then_some(cli.mcp_port));
			Ok(())
		}
	}
}

fn serve_mcp(devtools: &Devtools, port: u16) {
	let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
	devtools.set_mcp_url(Some(format!("http://{addr}/mcp")));
	let server = devtools.clone();
	devtools.runtime().spawn(async move {
		if let Err(error) = mcp::serve_http(server.clone(), addr).await {
			tracing::error!("MCP server on {addr} stopped: {error:#}");
			server.set_mcp_url(None);
		}
	});
}

fn run_gui(config: Config, mcp_port: Option<u16>) {
	let devtools = Devtools::start(config.clone());
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
			app::bind_keys(cx);
			let bounds = Bounds::centered(None, size(px(1280.), px(800.)), cx);
			let options = WindowOptions {
				window_bounds: Some(WindowBounds::Windowed(bounds)),
				titlebar: Some(TitlebarOptions {
					title: Some("Unbound DevTools".into()),
					..TitlebarOptions::default()
				}),
				window_min_size: Some(size(px(900.), px(560.))),
				app_id: Some("unbound-devtools".into()),
				..WindowOptions::default()
			};
			let opened = cx.open_window(options, |window, cx| {
				cx.new(|cx| app::Workspace::new(devtools, config, window, cx))
			});
			if let Err(error) = opened {
				tracing::error!("Could not open the window: {error:#}");
				cx.quit();
				return;
			}
			cx.activate(true);
		});
}
