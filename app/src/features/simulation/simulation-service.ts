import { BehaviorTree, BtNode, NodeStatus } from '../../types';

export class SimulationService {
  public stepSimulation(tree?: BehaviorTree): boolean {
    if (!tree?.root) return false;

    const root = tree.root;
    root.status = NodeStatus.RUNNING;

    if (root.children.length > 0) {
      root.children[0].status = NodeStatus.SUCCESS;
      if (root.children.length > 1) {
        root.children[1].status = NodeStatus.RUNNING;
      }
    }

    return true;
  }

  public resetSimulation(tree?: BehaviorTree): boolean {
    if (!tree?.root) return false;

    const clearStatus = (node: BtNode) => {
      node.status = NodeStatus.IDLE;
      node.children.forEach(clearStatus);
    };

    clearStatus(tree.root);
    return true;
  }
}

export const simulationService = new SimulationService();
