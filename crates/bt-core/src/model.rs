use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Node category according to BehaviorTree.CPP standard
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeCategory {
    Control,
    Decorator,
    Action,
    Condition,
    SubTree,
    Unknown,
}

impl NodeCategory {
    pub fn from_tag(tag: &str) -> Self {
        match tag {
            "Sequence"
            | "Fallback"
            | "ReactiveSequence"
            | "ReactiveFallback"
            | "Parallel"
            | "PipelineSequence"
            | "RecoveryNode"
            | "RoundRobin"
            | "IfThenElse"
            | "WhileDoElse"
            | "Switch2"
            | "Switch3" => NodeCategory::Control,

            "Inverter"
            | "ForceSuccess"
            | "ForceFailure"
            | "Repeat"
            | "RetryUntilSuccessful"
            | "RateController"
            | "GoalUpdater"
            | "SingleTrigger"
            | "SpeedController"
            | "Timeout"
            | "Delay"
            | "KeepRunningUntilFailure" => NodeCategory::Decorator,

            "SubTree" | "SubTreePlus" => NodeCategory::SubTree,

            _ => NodeCategory::Unknown,
        }
    }
}

/// Port definition inside custom TreeNodesModel
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PortModel {
    pub name: String,
    pub direction: String, // "input", "output", "inout"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Node model (e.g., from <TreeNodesModel> or standard library)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NodeModel {
    pub name: String,
    pub category: NodeCategory,
    pub ports: Vec<PortModel>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Node instance in a behavior tree AST
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BtNode {
    pub id: String,
    pub name: String, // Tag name (e.g. Sequence, NavigateToPose)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_name: Option<String>,
    pub category: NodeCategory,
    pub attributes: HashMap<String, String>,
    pub children: Vec<BtNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_number: Option<usize>,
}

/// A parsed BehaviorTree definition (<BehaviorTree ID="...">)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BehaviorTree {
    pub id: String,
    pub root: Option<BtNode>,
}

/// A parsed BT XML document
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BtDocument {
    pub main_tree: Option<String>,
    pub trees: Vec<BehaviorTree>,
    pub models: Vec<NodeModel>,
    pub source_path: Option<String>,
}

/// Result of scanning a workspace
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WorkspaceReport {
    pub root_dir: String,
    pub total_xml_files: usize,
    pub trees: Vec<WorkspaceTreeSummary>,
    pub models: Vec<NodeModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceTreeSummary {
    pub file_path: String,
    pub tree_id: String,
    pub is_main: bool,
    pub node_count: usize,
}
