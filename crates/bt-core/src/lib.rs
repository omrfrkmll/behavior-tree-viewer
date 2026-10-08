pub mod model;
pub mod parser;
pub mod scanner;

pub use model::*;
pub use parser::Parser;
pub use scanner::WorkspaceScanner;

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_XML: &str = r#"
<root main_tree_to_execute="MainTree">
  <BehaviorTree ID="MainTree">
    <Sequence name="MainSeq">
      <Action ID="SayHello" message="hello" />
      <SubTree ID="SubPlan" />
    </Sequence>
  </BehaviorTree>

  <TreeNodesModel>
    <Action ID="SayHello">
      <input_port name="message" default="hi">Greeting text</input_port>
    </Action>
  </TreeNodesModel>
</root>
"#;

    #[test]
    fn test_parse_sample() {
        let doc = Parser::parse_xml(SAMPLE_XML, Some("sample.xml")).expect("Failed to parse");
        assert_eq!(doc.main_tree.as_deref(), Some("MainTree"));
        assert_eq!(doc.trees.len(), 1);
        let tree = &doc.trees[0];
        assert_eq!(tree.id, "MainTree");
        let root = tree.root.as_ref().expect("Expected root node");
        assert_eq!(root.name, "Sequence");
        assert_eq!(root.children.len(), 2);

        // Models
        assert_eq!(doc.models.len(), 1);
        let model = &doc.models[0];
        assert_eq!(model.name, "SayHello");
        assert_eq!(model.ports.len(), 1);
        assert_eq!(model.ports[0].name, "message");
    }
}
