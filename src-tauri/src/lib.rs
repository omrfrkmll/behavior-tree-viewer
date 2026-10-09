use std::fs;
use bt_core::{BtDocument, Parser, WorkspaceReport, WorkspaceScanner};

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

#[tauri::command]
fn scan_workspace(path: String) -> Result<WorkspaceReport, String> {
    WorkspaceScanner::scan_dir(&path)
}

#[tauri::command]
fn parse_tree_xml(xml: String, filename: Option<String>) -> Result<BtDocument, String> {
    Parser::parse_xml(&xml, filename.as_deref())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            scan_workspace,
            parse_tree_xml
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
