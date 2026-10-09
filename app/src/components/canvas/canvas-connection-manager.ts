import * as d3 from 'd3';
import { BehaviorTree, BtNode, NodeModel, TagNode } from '../../types';
import { computeBezierWire } from '../../utils/math';
import { CanvasLayoutService } from './canvas-layout';
import { SocketType } from './canvas-types';

export interface ConnectionManagerOptions {
  zoomGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  tempLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  getTree: () => BehaviorTree | null;
  getCustomModels: () => NodeModel[];
  onTreeModified: () => void;
  onRenderGraph: (recalculateLayout: boolean) => void;
}

export class CanvasConnectionManager {
  private zoomGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private tempLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private getTree: () => BehaviorTree | null;
  private getCustomModels: () => NodeModel[];
  private onTreeModified: () => void;
  private onRenderGraph: (recalculateLayout: boolean) => void;

  // Connection Dragging State
  private connectingSourceNode: BtNode | null = null;
  private connectingMode: 'from-out' | 'from-in' = 'from-out';
  private connectingPortType: SocketType = 'out';
  private tempWirePath: d3.Selection<SVGPathElement, unknown, HTMLElement, any> | null = null;

  private connectingParamPort: {
    node: BtNode;
    portName: string;
    portType: string;
    startPos: { x: number; y: number };
  } | null = null;
  private tempParamWirePath: d3.Selection<SVGPathElement, unknown, HTMLElement, any> | null = null;

  constructor(options: ConnectionManagerOptions) {
    this.zoomGroup = options.zoomGroup;
    this.tempLayer = options.tempLayer;
    this.getTree = options.getTree;
    this.getCustomModels = options.getCustomModels;
    this.onTreeModified = options.onTreeModified;
    this.onRenderGraph = options.onRenderGraph;

    this.initWindowEvents();
  }

  public isConnecting(): boolean {
    return Boolean(this.connectingSourceNode || this.connectingParamPort);
  }

  public startConnecting(
    node: BtNode,
    mode: 'from-out' | 'from-in',
    portType: SocketType
  ) {
    this.cleanupTempWire();
    this.connectingSourceNode = node;
    this.connectingMode = mode;
    this.connectingPortType = portType;

    const customModels = this.getCustomModels();
    const sPos = CanvasLayoutService.getSocketCoords(node, portType as any, customModels);
    const strokeColor = portType === 'failure' ? 'var(--destructive, #ef4444)' : portType === 'success' ? '#22c55e' : 'var(--primary, #38bdf8)';
    this.tempWirePath = this.tempLayer.append('path')
      .attr('class', 'wire-temp')
      .attr('fill', 'none')
      .attr('stroke', strokeColor)
      .attr('stroke-width', '2.5')
      .attr('stroke-dasharray', '6 4')
      .attr('stroke-linecap', 'round')
      .style('pointer-events', 'none')
      .attr('d', `M ${sPos.x} ${sPos.y} L ${sPos.x} ${sPos.y}`);
  }

  public startConnectingParam(node: BtNode, portName: string, portType: string) {
    this.cleanupParamWire();
    const customModels = this.getCustomModels();
    const startPos = CanvasLayoutService.getParameterSocketCoords(node, portName, customModels);
    const model = customModels.find(m => m.name === node.name);
    const portDef = model?.ports?.find(p => p.name === portName);
    const isOutput = portDef?.direction === 'output';

    this.connectingParamPort = {
      node,
      portName,
      portType: portType || 'string',
      startPos
    };
    this.tempParamWirePath = this.tempLayer.append('path')
      .attr('class', 'wire-temp-data')
      .attr('fill', 'none')
      .attr('stroke', isOutput ? 'var(--primary)' : 'var(--accent-foreground, #38bdf8)')
      .attr('stroke-width', '2')
      .attr('stroke-dasharray', '6 4')
      .attr('stroke-linecap', 'round')
      .style('pointer-events', 'none')
      .attr('d', `M ${startPos.x} ${startPos.y} L ${startPos.x} ${startPos.y}`);
  }

  public cleanupTempWire() {
    this.connectingSourceNode = null;
    if (this.tempWirePath) {
      this.tempWirePath.remove();
      this.tempWirePath = null;
    }
  }

  public cleanupParamWire() {
    this.connectingParamPort = null;
    if (this.tempParamWirePath) {
      this.tempParamWirePath.remove();
      this.tempParamWirePath = null;
    }
  }

  public attachNode(
    parent: BtNode,
    child: BtNode,
    portType: 'out' | 'success' | 'failure' = 'out'
  ) {
    const tree = this.getTree();
    if (parent === child || !tree) {
      return;
    }

    // Leaf execution nodes (Action, Condition) cannot accept children in Behavior Trees
    if (parent.category === 'Action' || parent.category === 'Condition') {
      return;
    }

    let cur: BtNode | undefined = parent;
    while (cur) {
      if (cur === child) {
        return;
      }
      cur = cur.parent;
    }

    child.parentPort = portType;

    if (!parent.children.includes(child)) {
      if (child.parent) {
        const oldIdx = child.parent.children.indexOf(child);
        if (oldIdx !== -1) {
          child.parent.children.splice(oldIdx, 1);
        }
      }
      if (tree.floatingNodes) {
        const fIdx = tree.floatingNodes.indexOf(child);
        if (fIdx !== -1) {
          tree.floatingNodes.splice(fIdx, 1);
        }
      }
      parent.children.push(child);
      child.parent = parent;
    }

    if (tree.root === child) {
      let topAncestor: BtNode = parent;
      while (topAncestor.parent) {
        topAncestor = topAncestor.parent;
      }
      tree.root = topAncestor;
      if (tree.floatingNodes) {
        const pIdx = tree.floatingNodes.indexOf(topAncestor);
        if (pIdx !== -1) {
          tree.floatingNodes.splice(pIdx, 1);
        }
      }
    }

    this.onRenderGraph(false);
    this.onTreeModified();
  }

  public detachSequenceChild(seq: BtNode, child: BtNode, idx: number) {
    const tree = this.getTree();
    if (!tree) {
      return;
    }

    seq.children.splice(idx, 1);
    delete (seq as any)._cardHeight;
    delete (seq as any)._slotHeight;
    child.parent = undefined;
    child.parentPort = undefined;

    if (!tree.floatingNodes) {
      tree.floatingNodes = [];
    }
    if (!tree.floatingNodes.includes(child)) {
      tree.floatingNodes.push(child);
    }

    const customModels = this.getCustomModels();
    CanvasLayoutService.layoutContainerDirectChildren(seq, customModels);
    this.onRenderGraph(false);
    this.onTreeModified();
  }

  private initWindowEvents() {
    window.addEventListener('mousemove', (event: MouseEvent) => {
      if (!this.connectingSourceNode && !this.connectingParamPort) {
        return;
      }
      const zoomNode = this.zoomGroup.node();
      if (!zoomNode) {
        return;
      }

      const [mx, my] = d3.pointer(event, zoomNode);
      const customModels = this.getCustomModels();

      if (this.connectingSourceNode && this.tempWirePath) {
        const sPos = CanvasLayoutService.getSocketCoords(this.connectingSourceNode, this.connectingPortType, customModels);
        if (this.connectingMode === 'from-in') {
          this.tempWirePath.attr('d', computeBezierWire(mx, my, sPos.x, sPos.y));
        } else {
          this.tempWirePath.attr('d', computeBezierWire(sPos.x, sPos.y, mx, my));
        }
      }

      if (this.connectingParamPort && this.tempParamWirePath) {
        const sPos = this.connectingParamPort.startPos;
        this.tempParamWirePath.attr('d', computeBezierWire(sPos.x, sPos.y, mx, my));
      }
    });

    window.addEventListener('mouseup', (event: MouseEvent) => {
      const zoomNode = this.zoomGroup.node();
      const tree = this.getTree();
      const customModels = this.getCustomModels();

      // 1. Parameter socket wire dropped -> Create blackboard TagNode
      if (this.connectingParamPort && tree && zoomNode) {
        const [mx, my] = d3.pointer(event, zoomNode);
        const port = this.connectingParamPort;
        if (!tree.tagNodes) {
          tree.tagNodes = [];
        }
        const defaultVal = port.node.attributes[port.portName] || `{${port.portName}}`;
        const model = customModels.find(m => m.name === port.node.name);
        const portDef = model?.ports?.find(p => p.name === port.portName);
        const isOutput = portDef?.direction === 'output';
        const newTag: TagNode = {
          id: crypto.randomUUID(),
          name: port.portName,
          value: defaultVal,
          dataType: port.portType,
          targetNodeId: port.node.id,
          targetPortName: port.portName,
          direction: isOutput ? 'output' : 'input',
          x: mx,
          y: my
        };
        tree.tagNodes.push(newTag);
        port.node.attributes[port.portName] = defaultVal;
        this.cleanupParamWire();
        this.onRenderGraph(false);
        this.onTreeModified();
        return;
      }
      this.cleanupParamWire();

      // 2. Execution wire connecting dropped
      if (this.connectingSourceNode && tree && zoomNode) {
        const [mx, my] = d3.pointer(event, zoomNode);
        const srcNode = this.connectingSourceNode;
        const mode = this.connectingMode;
        const portType = this.connectingPortType;
        const allNodes = CanvasLayoutService.getAllTreeNodes(tree);

        let targetNode: BtNode | null = null;

        // Hit-test: Check if cursor dropped inside or near any node's card boundary
        for (const cand of allNodes) {
          if (cand === srcNode) {
            continue;
          }
          const h = CanvasLayoutService.getNodeHeight(cand, customModels);
          const w = CanvasLayoutService.getNodeWidth(cand);
          const cx = cand.x ?? 0;
          const cy = cand.y ?? 0;
          if (mx >= cx - w / 2 - 30 && mx <= cx + w / 2 + 30 &&
              my >= cy - h / 2 - 25 && my <= cy + h / 2 + 25) {
            targetNode = cand;
            break;
          }
        }

        // Proximity snap if dropped near socket
        if (!targetNode) {
          let minDistance = 120;
          for (const cand of allNodes) {
            if (cand === srcNode) {
              continue;
            }
            const targetPos = mode === 'from-out'
              ? CanvasLayoutService.getSocketCoords(cand, 'in', customModels)
              : CanvasLayoutService.getSocketCoords(cand, portType as any, customModels);
            const dist = Math.hypot(targetPos.x - mx, targetPos.y - my);
            if (dist < minDistance) {
              minDistance = dist;
              targetNode = cand;
            }
          }
        }

        if (targetNode) {
          if (mode === 'from-out') {
            this.attachNode(srcNode, targetNode, portType as any);
          } else {
            this.attachNode(targetNode, srcNode, 'out');
          }
        }
      }
      this.cleanupTempWire();
    });
  }
}
