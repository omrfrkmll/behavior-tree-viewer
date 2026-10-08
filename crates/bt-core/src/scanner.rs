use std::collections::HashSet;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

use crate::model::{WorkspaceReport, WorkspaceTreeSummary};
use crate::parser::Parser;

pub struct WorkspaceScanner;

impl WorkspaceScanner {
    /// Recursively scan a workspace directory for all XML files containing BehaviorTrees and TreeNodesModel
    pub fn scan_dir<P: AsRef<Path>>(root_dir: P) -> Result<WorkspaceReport, String> {
        let root = root_dir.as_ref();
        if !root.exists() {
            return Err(format!("Directory does not exist: {}", root.display()));
        }

        let mut total_xml_files = 0;
        let mut trees = Vec::new();
        let mut models = Vec::new();
        let mut seen_model_names = HashSet::new();

        for entry in WalkDir::new(root)
            .into_iter()
            .filter_entry(|e| {
                if e.depth() == 0 {
                    return true;
                }
                let name = e.file_name().to_string_lossy();
                // Skip hidden dirs and build artifacts
                !name.starts_with('.') && name != "node_modules" && name != "target" && name != "dist" && name != "build"
            })
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("xml") {
                total_xml_files += 1;
                if let Ok(content) = fs::read_to_string(path) {
                    if content.contains("<BehaviorTree") || content.contains("<TreeNodesModel") {
                        if let Ok(doc) = Parser::parse_xml(&content, Some(path.to_str().unwrap_or(""))) {
                            let path_str = path.to_string_lossy().to_string();
                            for t in &doc.trees {
                                let node_count = Self::count_nodes(t.root.as_ref());
                                let is_main = doc.main_tree.as_deref() == Some(&t.id);
                                trees.push(WorkspaceTreeSummary {
                                    file_path: path_str.clone(),
                                    tree_id: t.id.clone(),
                                    is_main,
                                    node_count,
                                });
                            }

                            for model in doc.models {
                                if !seen_model_names.contains(&model.name) {
                                    seen_model_names.insert(model.name.clone());
                                    models.push(model);
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(WorkspaceReport {
            root_dir: root.to_string_lossy().to_string(),
            total_xml_files,
            trees,
            models,
        })
    }

    fn count_nodes(node: Option<&crate::model::BtNode>) -> usize {
        match node {
            None => 0,
            Some(n) => 1 + n.children.iter().map(|c| Self::count_nodes(Some(c))).sum::<usize>(),
        }
    }
}
