use clap::{Parser as ClapParser, Subcommand};
use colored::*;
use std::fs;
use std::path::PathBuf;

use bt_core::{Parser, WorkspaceScanner};

#[derive(ClapParser)]
#[command(name = "btview")]
#[command(about = "BehaviorTree visualizer, workspace analyzer, and server", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Scan workspace directory for BehaviorTrees and custom TreeNodesModel
    Scan {
        /// Target directory to scan (defaults to current directory)
        #[arg(default_value = ".")]
        path: PathBuf,

        /// Output format: pretty or json
        #[arg(short, long, default_value = "pretty")]
        format: String,
    },

    /// Validate a BehaviorTree XML file
    Validate {
        /// Path to the XML file
        file: PathBuf,
    },

    /// Export a BehaviorTree XML file to JSON AST
    Export {
        /// Path to the XML file
        file: PathBuf,
        /// Output JSON path (prints to stdout if omitted)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },

    /// Serve local web visualizer for the current directory
    Serve {
        /// Port to listen on
        #[arg(short, long, default_value_t = 3000)]
        port: u16,

        /// Root workspace directory
        #[arg(default_value = ".")]
        path: PathBuf,
    },
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Scan { path, format } => {
            println!("{}", format!("🔍 Scanning workspace: {}", path.display()).cyan().bold());
            match WorkspaceScanner::scan_dir(&path) {
                Ok(report) => {
                    if format == "json" {
                        println!("{}", serde_json::to_string_pretty(&report).unwrap());
                    } else {
                        println!("{}", "--------------------------------------------------".dimmed());
                        println!("📁 Total XML Files: {}", report.total_xml_files.to_string().yellow());
                        println!("🌲 Behavior Trees Found: {}", report.trees.len().to_string().green().bold());
                        for tree in &report.trees {
                            let main_tag = if tree.is_main { " [MAIN]".green().bold() } else { "".normal() };
                            println!("   • {} (Nodes: {}){} in {}", 
                                tree.tree_id.bold(), 
                                tree.node_count.to_string().cyan(),
                                main_tag,
                                tree.file_path.dimmed()
                            );
                        }

                        println!("\n🧩 Custom Models Found: {}", report.models.len().to_string().magenta().bold());
                        for model in &report.models {
                            println!("   • [{:?}] {} (Ports: {})", 
                                model.category, 
                                model.name.bold(), 
                                model.ports.len()
                            );
                        }
                        println!("{}", "--------------------------------------------------".dimmed());
                    }
                }
                Err(err) => {
                    eprintln!("{} {}", "❌ Error scanning workspace:".red().bold(), err);
                    std::process::exit(1);
                }
            }
        }

        Commands::Validate { file } => {
            let content = match fs::read_to_string(&file) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("{} Cannot read file {}: {}", "❌ Error:".red(), file.display(), e);
                    std::process::exit(1);
                }
            };

            match Parser::parse_xml(&content, Some(file.to_str().unwrap_or(""))) {
                Ok(doc) => {
                    println!("{} File {} is valid BehaviorTree XML!", "✅ Success:".green().bold(), file.display());
                    println!("   • Trees defined: {}", doc.trees.len());
                    println!("   • Main tree: {}", doc.main_tree.unwrap_or_else(|| "None".into()));
                    println!("   • Custom models: {}", doc.models.len());
                }
                Err(err) => {
                    eprintln!("{} Invalid BT XML in {}: {}", "❌ Error:".red().bold(), file.display(), err);
                    std::process::exit(1);
                }
            }
        }

        Commands::Export { file, output } => {
            let content = match fs::read_to_string(&file) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("{} Cannot read file: {}", "❌ Error:".red(), e);
                    std::process::exit(1);
                }
            };

            match Parser::parse_xml(&content, Some(file.to_str().unwrap_or(""))) {
                Ok(doc) => {
                    let json = serde_json::to_string_pretty(&doc).unwrap();
                    if let Some(out_path) = output {
                        if let Err(e) = fs::write(&out_path, &json) {
                            eprintln!("{} Failed to write to {}: {}", "❌ Error:".red(), out_path.display(), e);
                            std::process::exit(1);
                        }
                        println!("{} Exported AST to {}", "✅ Success:".green(), out_path.display());
                    } else {
                        println!("{}", json);
                    }
                }
                Err(err) => {
                    eprintln!("{} Parse failed: {}", "❌ Error:".red(), err);
                    std::process::exit(1);
                }
            }
        }

        Commands::Serve { port, path } => {
            println!("{} Starting Behavior Tree HTTP server on http://localhost:{} ...", "🚀".cyan(), port);
            println!("📂 Serving workspace: {}", path.display());
            let server = tiny_http::Server::http(format!("0.0.0.0:{}", port)).expect("Failed to bind server port");

            for request in server.incoming_requests() {
                let url = request.url().to_string();
                if url == "/api/workspace" {
                    let report = WorkspaceScanner::scan_dir(&path).unwrap_or_default();
                    let json = serde_json::to_string(&report).unwrap();
                    let response = tiny_http::Response::from_string(json)
                        .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                        .with_header(tiny_http::Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
                    let _ = request.respond(response);
                } else if url.starts_with("/api/file?path=") {
                    let file_param = &url["/api/file?path=".len()..];
                    let decoded_path = urlencoding_decode(file_param);
                    if let Ok(content) = fs::read_to_string(&decoded_path) {
                        let response = tiny_http::Response::from_string(content)
                            .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/xml"[..]).unwrap())
                            .with_header(tiny_http::Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
                        let _ = request.respond(response);
                    } else {
                        let _ = request.respond(tiny_http::Response::from_string("File not found").with_status_code(404));
                    }
                } else {
                    let response = tiny_http::Response::from_string("BehaviorTree Visualizer Server is Running. Open your web app to connect.")
                        .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/plain"[..]).unwrap());
                    let _ = request.respond(response);
                }
            }
        }
    }
}

fn urlencoding_decode(s: &str) -> String {
    // Simple query param decode for paths
    s.replace("%2F", "/").replace("%20", " ")
}
