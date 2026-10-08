import { BehaviorTree, BtNode, NodeModel } from '../../types';
import { NodeShapeRegistry } from './nodes/registry';

export const CANVAS_CONSTANTS = {
  NODE_WIDTH: 230,
  SEQUENCE_WIDTH: 284,
  ROW_HEIGHT: 20,
  HEADER_HEIGHT: 32,
  SPINE_WIDTH: 26,
  SEQUENCE_HEADER_H: 36,
  SEQUENCE_FOOTER_H: 22,
  SEQUENCE_PAD_TOP: 10,
  SEQUENCE_PAD_BOT: 10,
  SEQUENCE_CHILD_GAP: 12,
  SEQUENCE_ADD_BTN_H: 24,
};

export class CanvasLayoutService {
  public static getNodeWidth(node: BtNode): number {
    return NodeShapeRegistry.getRenderer(node).getWidth(node);
  }

  public static getBasicNodeHeight(node: BtNode, customModels: NodeModel[]): number {
    const model = customModels.find(m => m.name === node.name);
    const ports = model?.ports || [];
    const portCount = ports.length || Object.keys(node.attributes).length || 0;
    const customNameExtra = (node.customName && node.customName !== node.name) ? 12 : 0;
    if (portCount === 0) {
      return 46 + customNameExtra;
    }
    return CANVAS_CONSTANTS.HEADER_HEIGHT + 14 + (portCount * CANVAS_CONSTANTS.ROW_HEIGHT) + customNameExtra;
  }

  public static getNodeHeight(node: BtNode, customModels: NodeModel[]): number {
    return NodeShapeRegistry.getRenderer(node).getHeight(node, customModels);
  }

  public static getCBracketPath(w: number, h: number, spineW: number, topH: number, botH: number, r: number = 8): string {
    const x0 = -w / 2;
    const x1 = -w / 2 + spineW;
    const x2 = w / 2;
    const y0 = -h / 2;
    const y1 = -h / 2 + topH;
    const y2 = h / 2 - botH;
    const y3 = h / 2;

    return [
      `M ${x0 + r} ${y0}`,
      `H ${x2 - r}`,
      `A ${r} ${r} 0 0 1 ${x2} ${y0 + r}`,
      `V ${y1 - r}`,
      `A ${r} ${r} 0 0 1 ${x2 - r} ${y1}`,
      `H ${x1 + r}`,
      `A ${r} ${r} 0 0 0 ${x1} ${y1 + r}`,
      `V ${y2 - r}`,
      `A ${r} ${r} 0 0 0 ${x1 + r} ${y2}`,
      `H ${x2 - r}`,
      `A ${r} ${r} 0 0 1 ${x2} ${y2 + r}`,
      `V ${y3 - r}`,
      `A ${r} ${r} 0 0 1 ${x2 - r} ${y3}`,
      `H ${x0 + r}`,
      `A ${r} ${r} 0 0 1 ${x0} ${y3 - r}`,
      `V ${y0 + r}`,
      `A ${r} ${r} 0 0 1 ${x0 + r} ${y0}`,
      `Z`
    ].join(' ');
  }

  public static calculateSubtreeHeights(node: BtNode, customModels: NodeModel[]): number {
    const isContainer = NodeShapeRegistry.isContainer(node);

    if (node.collapsed || !node.children || node.children.length === 0) {
      const cardH = isContainer
        ? NodeShapeRegistry.getRenderer(node).getHeight(node, customModels)
        : this.getBasicNodeHeight(node, customModels);
      (node as any)._cardHeight = cardH;
      (node as any)._slotHeight = cardH;
      return cardH;
    }

    if (isContainer) {
      const branchGap = 20;
      let totalBranchH = 0;
      let branchingCount = 0;

      node.children.forEach(child => {
        this.calculateSubtreeHeights(child, customModels);

        if (!child.collapsed && child.children && child.children.length > 0) {
          totalBranchH += (child as any)._slotHeight + (branchingCount > 0 ? branchGap : 0);
          branchingCount++;
        }
      });

      const seqCardH = NodeShapeRegistry.getRenderer(node).getHeight(node, customModels);

      (node as any)._cardHeight = seqCardH;
      (node as any)._slotHeight = Math.max(seqCardH, totalBranchH);
      return (node as any)._slotHeight;
    } else {
      const cardH = this.getBasicNodeHeight(node, customModels);
      (node as any)._cardHeight = cardH;

      let childrenTotalH = 0;
      const branchGap = 20;
      node.children.forEach((child, idx) => {
        const childSubtreeH = this.calculateSubtreeHeights(child, customModels);
        childrenTotalH += childSubtreeH + (idx > 0 ? branchGap : 0);
      });

      const totalSubtreeH = Math.max(cardH, childrenTotalH);
      (node as any)._slotHeight = totalSubtreeH;
      return totalSubtreeH;
    }
  }

  public static assignPositions(node: BtNode, cx: number, cy: number, customModels: NodeModel[]) {
    node.x = cx;
    node.y = cy;

    if (node.collapsed || !node.children || node.children.length === 0) {
      return;
    }

    const nodeW = this.getNodeWidth(node);
    const isContainer = NodeShapeRegistry.isContainer(node);

    if (isContainer) {
      const spineW = CANVAS_CONSTANTS.SPINE_WIDTH;
      const padLeft = 14;
      const childW = CANVAS_CONSTANTS.NODE_WIDTH;
      const childCenterX = cx - nodeW / 2 + spineW + padLeft + childW / 2;

      const topH = CANVAS_CONSTANTS.SEQUENCE_HEADER_H;
      const padTop = CANVAS_CONSTANTS.SEQUENCE_PAD_TOP;
      const cardH = (node as any)._cardHeight || this.getNodeHeight(node, customModels);
      let currentY = cy - cardH / 2 + topH + padTop;
      const childGap = CANVAS_CONSTANTS.SEQUENCE_CHILD_GAP;

      // 1. Position direct children compactly inside the C-bracket mouth
      node.children.forEach(child => {
        const isChildContainer = NodeShapeRegistry.isContainer(child);
        const ch = isChildContainer
          ? this.getNodeHeight(child, customModels)
          : this.getBasicNodeHeight(child, customModels);
        const childCenterY = currentY + ch / 2;

        child.x = childCenterX;
        child.y = childCenterY;

        if (isChildContainer) {
          this.assignPositions(child, childCenterX, childCenterY, customModels);
        }

        currentY += ch + childGap;
      });

      // 2. Position external branches to the right of the Sequence in non-overlapping vertical slots
      const branchingChildren = node.children.filter(
        c => !NodeShapeRegistry.isContainer(c) && !c.collapsed && c.children && c.children.length > 0
      );
      if (branchingChildren.length > 0) {
        const branchGap = 20;
        let totalBranchH = 0;
        branchingChildren.forEach((child, idx) => {
          totalBranchH += ((child as any)._slotHeight || this.getBasicNodeHeight(child, customModels)) + (idx > 0 ? branchGap : 0);
        });

        const branchStartX = cx + nodeW / 2 + 80;
        let branchY = cy - totalBranchH / 2;

        branchingChildren.forEach(child => {
          const slotH = (child as any)._slotHeight || this.getBasicNodeHeight(child, customModels);
          const branchCenterY = branchY + slotH / 2;

          this.assignChildrenPositions(child, branchStartX, branchCenterY, customModels);

          branchY += slotH + branchGap;
        });
      }
    } else {
      const branchStartX = cx + nodeW / 2 + 80;
      this.assignChildrenPositions(node, branchStartX, cy, customModels);
    }
  }

  private static assignChildrenPositions(parent: BtNode, branchStartX: number, parentCenterY: number, customModels: NodeModel[]) {
    const children = parent.children;
    if (!children || children.length === 0) return;

    const branchGap = 20;
    let totalH = 0;
    children.forEach((child, idx) => {
      totalH += ((child as any)._slotHeight || this.getBasicNodeHeight(child, customModels)) + (idx > 0 ? branchGap : 0);
    });

    let currentY = parentCenterY - totalH / 2;

    children.forEach(child => {
      const slotH = (child as any)._slotHeight || this.getBasicNodeHeight(child, customModels);
      const childCenterY = currentY + slotH / 2;
      const childW = this.getNodeWidth(child);
      const childCenterX = branchStartX + childW / 2;

      this.assignPositions(child, childCenterX, childCenterY, customModels);

      currentY += slotH + branchGap;
    });
  }

  public static computeTreeLayout(root: BtNode, customModels: NodeModel[], startY = 0) {
    this.calculateSubtreeHeights(root, customModels);
    this.assignPositions(root, 180, startY, customModels);
  }

  public static getAllTreeNodes(tree: BehaviorTree): BtNode[] {
    const nodes: BtNode[] = [];
    const visit = (n: BtNode) => {
      nodes.push(n);
      if (!n.collapsed && n.children) {
        n.children.forEach(child => {
          child.parent = n;
          visit(child);
        });
      }
    };
    if (tree.root) visit(tree.root);
    if (tree.floatingNodes) tree.floatingNodes.forEach(visit);
    return nodes;
  }

  public static getNodeOutputSockets(node: BtNode): Array<'out' | 'success' | 'failure'> {
    const renderer = NodeShapeRegistry.getRenderer(node);
    if (renderer.getOutputSockets) {
      return renderer.getOutputSockets(node);
    }
    return ['out'];
  }

  public static getSocketCoords(
    node: BtNode,
    portType: 'in' | 'success' | 'failure' | 'out',
    customModels: NodeModel[]
  ): { x: number; y: number } {
    const renderer = NodeShapeRegistry.getRenderer(node);
    if (renderer.getSocketCoords) {
      return renderer.getSocketCoords(node, portType, customModels);
    }

    const nx = node.x ?? 0;
    const ny = node.y ?? 0;
    const halfW = this.getNodeWidth(node) / 2;
    const h = this.getNodeHeight(node, customModels);
    const headerCenterY = ny - h / 2 + 16;

    switch (portType) {
      case 'in':
        return { x: nx - halfW, y: headerCenterY };
      case 'success':
        return { x: nx + halfW, y: headerCenterY - 7 };
      case 'failure':
        return { x: nx + halfW, y: headerCenterY + 8 };
      case 'out':
      default:
        return { x: nx + halfW, y: headerCenterY };
    }
  }

  public static getParameterSocketCoords(
    node: BtNode,
    portName: string,
    customModels: NodeModel[]
  ): { x: number; y: number } {
    const renderer = NodeShapeRegistry.getRenderer(node);
    if (renderer.getParameterSocketCoords) {
      return renderer.getParameterSocketCoords(node, portName, customModels);
    }

    const nx = node.x ?? 0;
    const ny = node.y ?? 0;
    const halfW = this.getNodeWidth(node) / 2;
    const h = this.getNodeHeight(node, customModels);
    const model = customModels.find(m => m.name === node.name);
    const ports = model?.ports || [];
    const idx = ports.findIndex(p => p.name === portName);
    const portDef = idx !== -1 ? ports[idx] : null;
    const isInput = !portDef || portDef.direction === 'input';

    const customNameExtra = (node.customName && node.customName !== node.name) ? 12 : 0;
    const portYStart = -h / 2 + CANVAS_CONSTANTS.HEADER_HEIGHT + 14 + customNameExtra;
    const rowY = portYStart + ((idx >= 0 ? idx : 0) * CANVAS_CONSTANTS.ROW_HEIGHT);

    return {
      x: isInput ? nx - halfW : nx + halfW,
      y: ny + rowY
    };
  }
}
