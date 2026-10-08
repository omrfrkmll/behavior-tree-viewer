export enum NodeCategory {
  Control = 'Control',
  Decorator = 'Decorator',
  Action = 'Action',
  Condition = 'Condition',
  SubTree = 'SubTree',
  Unknown = 'Unknown'
}

export enum NodeStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE'
}

export interface PortDefinition {
  name: string;
  direction: 'input' | 'output' | 'inout';
  type?: string;          // e.g. "geometry_msgs::msg::PoseStamped", "std::string", "double"
  defaultValue?: string;
  description?: string;
}

export interface NodeModel {
  name: string;
  category: NodeCategory;
  ports: PortDefinition[];
  description?: string;
}

export interface BtNode {
  id: string;
  name: string;
  customName?: string;
  category: NodeCategory;
  attributes: Record<string, string>;
  children: BtNode[];
  parent?: BtNode;
  parentPort?: 'success' | 'failure';
  collapsed?: boolean;
  status: NodeStatus;
  x?: number;
  y?: number;
}

export interface TagNode {
  id: string;
  name: string;
  value: string;
  dataType: string;
  targetNodeId: string;
  targetPortName: string;
  x: number;
  y: number;
}

export interface BehaviorTree {
  id: string;
  root?: BtNode;
  floatingNodes?: BtNode[];
  tagNodes?: TagNode[];
}

export interface WorkspaceSummary {
  rootDir: string;
  totalXmlFiles: number;
  trees: Array<{
    filePath: string;
    treeId: string;
    isMain: boolean;
    nodeCount: number;
  }>;
  models: NodeModel[];
}

export interface InputTag {
  name: string;
  value: string;
  type?: string;
  isBlackboard?: boolean;
}
