import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import { BehaviorTree, BtNode, NodeModel, NodeStatus } from '../../types';
import { detectCategory } from '../../utils/category';

export class XmlService {
  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    preserveOrder: true,
    allowBooleanAttributes: true,
    parseAttributeValue: false
  });

  private builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    suppressEmptyNode: true,
    preserveOrder: true
  });

  public validateXml(xmlString: string): { valid: boolean; error?: string; line?: number; col?: number } {
    const result = XMLValidator.validate(xmlString);
    if (result === true) {
      return { valid: true };
    }
    return {
      valid: false,
      error: (result as any).err?.msg || 'Invalid XML syntax',
      line: (result as any).err?.line,
      col: (result as any).err?.col
    };
  }

  public formatXml(rawXml: string): string {
    try {
      const parsed = this.parser.parse(rawXml);
      return this.builder.build(parsed);
    } catch {
      return rawXml;
    }
  }

  public parseXml(xmlContent: string, customModels: NodeModel[]): { trees: BehaviorTree[]; newModels: NodeModel[] } {
    try {
      const parsed = this.parser.parse(xmlContent);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { trees: [], newModels: [] };
      }

      const rootObj = parsed.find(item => item['root'] || item['root_tree']);
      const rootChildren = rootObj ? (rootObj['root'] || rootObj['root_tree']) : parsed;

      const trees: BehaviorTree[] = [];
      const newModels: NodeModel[] = [];

      const modelsEntry = rootChildren.find((item: any) => item['TreeNodesModel']);
      if (modelsEntry && modelsEntry['TreeNodesModel']) {
        this.extractTreeModels(modelsEntry['TreeNodesModel'], customModels, newModels);
      }

      const findBehaviorTrees = (nodes: any[]) => {
        nodes.forEach(child => {
          if (child['BehaviorTree']) {
            const attrs = this.getAttributes(child);
            const treeId = attrs.ID || attrs.id || attrs.name || `Tree_${trees.length + 1}`;
            const treeRoot = this.transformXmlNode(child['BehaviorTree'][0]);
            if (treeRoot) {
              trees.push({ id: treeId, root: treeRoot });
            }
          }
          const tagName = Object.keys(child).find(k => k !== ':@');
          if (tagName && Array.isArray(child[tagName])) {
            findBehaviorTrees(child[tagName]);
          }
        });
      };

      findBehaviorTrees(rootChildren);

      this.linkSubTrees(trees);

      return { trees, newModels };

    } catch (err) {
      console.error('Failed to parse XML:', err);
      return { trees: [], newModels: [] };
    }
  }

  private getAttributes(xmlObj: any): Record<string, string> {
    if (!xmlObj || !xmlObj[':@']) return {};
    const raw = xmlObj[':@'];
    if (raw[':@'] && typeof raw[':@'] === 'object') return raw[':@'];
    return raw;
  }

  private extractTreeModels(modelsArray: any[], existingModels: NodeModel[], outNewModels: NodeModel[]) {
    modelsArray.forEach(m => {
      const tagName = Object.keys(m).find(k => k !== ':@');
      if (!tagName) return;

      const attrs = this.getAttributes(m);
      const modelName = attrs.ID || attrs.name || tagName;
      const category = detectCategory(tagName);

      if (!existingModels.some(existing => existing.name === modelName) &&
          !outNewModels.some(existing => existing.name === modelName)) {
        outNewModels.push({
          name: modelName,
          category,
          ports: [],
          description: attrs.description
        });
      }
    });
  }

  private transformXmlNode(xmlObj: any): BtNode | null {
    if (!xmlObj) return null;
    const tagName = Object.keys(xmlObj).find(k => k !== ':@');
    if (!tagName) return null;

    const attributes = this.getAttributes(xmlObj);
    const childrenArray = xmlObj[tagName] || [];
    const customName = attributes.name || attributes.ID;
    const category = detectCategory(tagName);

    const node: BtNode = {
      id: crypto.randomUUID(),
      name: tagName,
      customName: (customName && customName !== tagName) ? customName : undefined,
      category,
      attributes: { ...attributes },
      children: [],
      status: NodeStatus.IDLE
    };

    if (Array.isArray(childrenArray)) {
      childrenArray.forEach(child => {
        const childNode = this.transformXmlNode(child);
        if (childNode) {
          childNode.parent = node;
          node.children.push(childNode);
        }
      });
    }

    return node;
  }

  private linkSubTrees(trees: BehaviorTree[]) {
    const treeMap = new Map<string, BehaviorTree>();
    trees.forEach(t => treeMap.set(t.id, t));

    const cloneForSubtree = (n: BtNode, parent?: BtNode): BtNode => {
      const clone: BtNode = {
        ...n,
        id: crypto.randomUUID(),
        parent,
        attributes: { ...n.attributes },
        children: []
      };
      clone.children = (n.children || []).map(c => cloneForSubtree(c, clone));
      return clone;
    };

    const visit = (n: BtNode) => {
      if (n.name === 'SubTree' || n.category === 'SubTree') {
        const targetId = n.attributes.ID || n.customName || n.attributes.name;
        if (targetId && treeMap.has(targetId) && n.children.length === 0) {
          const targetTree = treeMap.get(targetId)!;
          if (targetTree.root) {
            const inlined = cloneForSubtree(targetTree.root, n);
            n.children.push(inlined);
          }
        }
      }
      n.children.forEach(visit);
    };

    trees.forEach(t => {
      if (t.root) visit(t.root);
    });
  }

  public serializeAllTreesToXml(trees: BehaviorTree[], mainTreeId?: string): string {
    if (!trees || trees.length === 0) {
      return '<!-- No Tree Available -->';
    }

    const nodeToObj = (n: BtNode): any => {
      const attrs = { ...n.attributes };
      if (n.customName) attrs['name'] = n.customName;

      const obj: any = { ':@': attrs };
      const childrenToWrite = (n.name === 'SubTree' && (attrs['ID'] || attrs['name'])) ? [] : n.children;
      obj[n.name] = (childrenToWrite || []).map(nodeToObj);
      return obj;
    };

    const validTrees = trees.filter(t => t.root);
    if (validTrees.length === 0) {
      return '<!-- No Tree Available -->';
    }

    const treeObjs = validTrees.map(t => ({
      ':@': { ID: t.id },
      BehaviorTree: [nodeToObj(t.root!)]
    }));

    const rootDoc = [
      {
        ':@': { main_tree_to_execute: mainTreeId || validTrees[0].id },
        root: treeObjs
      }
    ];

    try {
      return this.builder.build(rootDoc);
    } catch (e) {
      console.error('XML formatting error', e);
      return '<!-- XML generation error -->';
    }
  }

  public serializeTreeToXml(tree: BehaviorTree): string {
    if (!tree?.root) {
      return '<!-- No Tree Available -->';
    }
    return this.serializeAllTreesToXml([tree], tree.id);
  }

  public downloadXmlFile(xmlContent: string, fileName: string) {
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const xmlService = new XmlService();
