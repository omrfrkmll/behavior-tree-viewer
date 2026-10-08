use std::collections::HashMap;
use quick_xml::events::Event;
use quick_xml::Reader;

use crate::model::{BehaviorTree, BtDocument, BtNode, NodeCategory, NodeModel, PortModel};

pub struct Parser;

impl Parser {
    pub fn parse_xml(xml_content: &str, source_path: Option<&str>) -> Result<BtDocument, String> {
        let mut reader = Reader::from_str(xml_content);
        reader.config_mut().trim_text(true);

        let mut doc = BtDocument {
            main_tree: None,
            trees: Vec::new(),
            models: Vec::new(),
            source_path: source_path.map(|s| s.to_string()),
        };

        let mut buf = Vec::new();
        let mut node_counter = 0usize;

        // Tree build stack
        let mut active_tree: Option<BehaviorTree> = None;
        let mut node_stack: Vec<BtNode> = Vec::new();

        // Model build stack
        let mut in_tree_nodes_model = false;
        let mut active_model: Option<NodeModel> = None;

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    let tag_name_bytes = e.name().into_inner();
                    let tag_name = String::from_utf8_lossy(tag_name_bytes).to_string();
                    let attrs = Self::extract_attributes(e)?;

                    if tag_name == "root" {
                        if let Some(main) = attrs.get("main_tree_to_execute") {
                            doc.main_tree = Some(main.clone());
                        }
                    } else if tag_name == "TreeNodesModel" {
                        in_tree_nodes_model = true;
                    } else if in_tree_nodes_model {
                        if let Some(ref mut model) = active_model {
                            // Tag inside active_model, e.g. <input_port ...>
                            let direction = match tag_name.as_str() {
                                "input_port" => "input",
                                "output_port" => "output",
                                "inout_port" => "inout",
                                _ => "port",
                            };
                            if let Some(port_name) = attrs.get("name").cloned() {
                                model.ports.push(PortModel {
                                    name: port_name,
                                    direction: direction.to_string(),
                                    default_value: attrs.get("default").cloned(),
                                    description: attrs.get("description").cloned(),
                                });
                            }
                        } else {
                            let category = match tag_name.as_str() {
                                "Action" => NodeCategory::Action,
                                "Condition" => NodeCategory::Condition,
                                "Control" => NodeCategory::Control,
                                "Decorator" => NodeCategory::Decorator,
                                "SubTree" => NodeCategory::SubTree,
                                _ => NodeCategory::Unknown,
                            };
                            let name = attrs.get("ID").cloned().unwrap_or_else(|| tag_name.clone());
                            active_model = Some(NodeModel {
                                name,
                                category,
                                ports: Vec::new(),
                                description: attrs.get("description").cloned(),
                            });
                        }
                    } else if tag_name == "BehaviorTree" {
                        let id = attrs.get("ID").cloned().unwrap_or_else(|| "DefaultTree".to_string());
                        active_tree = Some(BehaviorTree { id, root: None });
                        node_stack.clear();
                    } else if active_tree.is_some() {
                        node_counter += 1;
                        let custom_name = attrs.get("name").or_else(|| attrs.get("ID")).cloned();
                        let category = NodeCategory::from_tag(&tag_name);

                        let node = BtNode {
                            id: format!("node_{}", node_counter),
                            name: tag_name,
                            custom_name,
                            category,
                            attributes: attrs,
                            children: Vec::new(),
                            line_number: None,
                        };
                        node_stack.push(node);
                    }
                }
                Ok(Event::Empty(ref e)) => {
                    let tag_name_bytes = e.name().into_inner();
                    let tag_name = String::from_utf8_lossy(tag_name_bytes).to_string();
                    let attrs = Self::extract_attributes(e)?;

                    if in_tree_nodes_model {
                        if let Some(ref mut model) = active_model {
                            // Port definition: <input_port name="..." />, <output_port ...>, <inout_port ...>
                            let direction = match tag_name.as_str() {
                                "input_port" => "input",
                                "output_port" => "output",
                                "inout_port" => "inout",
                                _ => "port",
                            };
                            if let Some(port_name) = attrs.get("name").cloned() {
                                model.ports.push(PortModel {
                                    name: port_name,
                                    direction: direction.to_string(),
                                    default_value: attrs.get("default").cloned(),
                                    description: attrs.get("description").cloned(),
                                });
                            }
                        } else {
                            // Self-closing node model e.g. <Action ID="SimpleAction"/>
                            let category = match tag_name.as_str() {
                                "Action" => NodeCategory::Action,
                                "Condition" => NodeCategory::Condition,
                                "Control" => NodeCategory::Control,
                                "Decorator" => NodeCategory::Decorator,
                                "SubTree" => NodeCategory::SubTree,
                                _ => NodeCategory::Unknown,
                            };
                            let name = attrs.get("ID").cloned().unwrap_or_else(|| tag_name.clone());
                            doc.models.push(NodeModel {
                                name,
                                category,
                                ports: Vec::new(),
                                description: attrs.get("description").cloned(),
                            });
                        }
                    } else if active_tree.is_some() {
                        node_counter += 1;
                        let custom_name = attrs.get("name").or_else(|| attrs.get("ID")).cloned();
                        let category = NodeCategory::from_tag(&tag_name);

                        let node = BtNode {
                            id: format!("node_{}", node_counter),
                            name: tag_name,
                            custom_name,
                            category,
                            attributes: attrs,
                            children: Vec::new(),
                            line_number: None,
                        };

                        if let Some(parent) = node_stack.last_mut() {
                            parent.children.push(node);
                        } else if let Some(ref mut tree) = active_tree {
                            tree.root = Some(node);
                        }
                    }
                }
                Ok(Event::End(ref e)) => {
                    let tag_name_bytes = e.name().into_inner();
                    let tag_name = String::from_utf8_lossy(tag_name_bytes).to_string();

                    if tag_name == "TreeNodesModel" {
                        in_tree_nodes_model = false;
                    } else if in_tree_nodes_model && active_model.is_some() {
                        if let Some(model) = active_model.take() {
                            doc.models.push(model);
                        }
                    } else if tag_name == "BehaviorTree" {
                        if let Some(mut tree) = active_tree.take() {
                            if tree.root.is_none() && !node_stack.is_empty() {
                                tree.root = Some(node_stack.remove(0));
                            }
                            doc.trees.push(tree);
                        }
                        node_stack.clear();
                    } else if active_tree.is_some() {
                        if let Some(finished_node) = node_stack.pop() {
                            if let Some(parent) = node_stack.last_mut() {
                                parent.children.push(finished_node);
                            } else if let Some(ref mut tree) = active_tree {
                                tree.root = Some(finished_node);
                            }
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(format!("XML parsing error: {}", e)),
                _ => {}
            }
            buf.clear();
        }

        // If main_tree not explicitly defined, fallback to first tree
        if doc.main_tree.is_none() {
            if let Some(first_tree) = doc.trees.first() {
                doc.main_tree = Some(first_tree.id.clone());
            }
        }

        Ok(doc)
    }

    fn extract_attributes(e: &quick_xml::events::BytesStart) -> Result<HashMap<String, String>, String> {
        let mut map = HashMap::new();
        for attr_result in e.attributes() {
            let attr = attr_result.map_err(|err| format!("Attribute parse error: {}", err))?;
            let key = String::from_utf8_lossy(attr.key.into_inner()).to_string();
            let value = String::from_utf8_lossy(&attr.value).to_string();
            map.insert(key, value);
        }
        Ok(map)
    }
}
