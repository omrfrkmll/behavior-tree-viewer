import * as d3 from 'd3';
import { BehaviorTree, BtNode, NodeModel, NodeStatus, TagNode } from '../../types';
import { computeBezierWire } from '../../utils/math';
import { CanvasLayoutService, CANVAS_CONSTANTS } from './canvas-layout';
import { NodeRenderer, NodeShapeRegistry } from './nodes';
import { WireRenderer } from './wire-renderer';

export interface CanvasViewerCallbacks {
  onNodeSelected: (node: BtNode | null) => void;
  onTagSelected?: (tag: TagNode | null) => void;
  onTreeModified: () => void;
  onShowPortPopover: (node: BtNode, portName: string, anchor: DOMRect | { clientX: number; clientY: number }) => void;
  onHidePopover: () => void;
  onZoomChange?: (zoomPercent: number) => void;
}

export class CanvasViewerComponent {
  private svg!: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private zoomGroup!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private wiresLayer!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private dataWiresLayer!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private nodesLayer!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private tagNodesLayer!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private tempLayer!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private zoomBehavior!: d3.ZoomBehavior<SVGSVGElement, unknown>;

  // Selection & Navigation State
  private selectedNodes: Set<BtNode> = new Set();
  private selectedTag: TagNode | null = null;
  private isSpacePressed = false;
  private isMarqueeSelecting = false;
  private justFinishedMarquee = false;
  private marqueeStart: { x: number; y: number } | null = null;
  private marqueeRect: d3.Selection<SVGRectElement, unknown, HTMLElement, any> | null = null;

  // Connection Dragging State
  private connectingSourceNode: BtNode | null = null;
  private connectingMode: 'from-out' | 'from-in' = 'from-out';
  private connectingPortType: 'success' | 'failure' | 'out' | 'in' = 'out';
  private tempWirePath: d3.Selection<SVGPathElement, unknown, HTMLElement, any> | null = null;

  private connectingParamPort: { node: BtNode; portName: string; portType: string; startPos: { x: number; y: number } } | null = null;
  private tempParamWirePath: d3.Selection<SVGPathElement, unknown, HTMLElement, any> | null = null;
  private dropIndicatorLine: d3.Selection<SVGLineElement, unknown, HTMLElement, any> | null = null;

  private currentTree: BehaviorTree | null = null;
  private customModels: NodeModel[] = [];
  private selectedNode: BtNode | null = null;

  constructor(private callbacks: CanvasViewerCallbacks) {
    this.initCanvas();
    this.initGridControls();
  }

  public setGridMode(mode: 'dots' | 'lines' | 'empty') {
    const gridEl = document.getElementById('blueprint-grid');
    if (gridEl) {
      gridEl.className = `absolute inset-0 w-full h-full pointer-events-none ${
        mode === 'empty' ? 'grid-empty' : mode === 'lines' ? 'grid-lines' : 'grid-dots'
      }`;
    }
  }

  private initGridControls() {
    const gridBtns = document.querySelectorAll<HTMLButtonElement>('#canvas-grid-controls .grid-btn');
    gridBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        gridBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.grid as 'dots' | 'lines' | 'empty';
        if (mode) this.setGridMode(mode);
      });
    });
  }

  private initCanvas() {
    this.svg = d3.select<SVGSVGElement, unknown>('#tree-svg');
    this.zoomGroup = d3.select<SVGGElement, unknown>('#viewport-group');
    this.dataWiresLayer = d3.select<SVGGElement, unknown>('#data-wires-layer');
    this.wiresLayer = d3.select<SVGGElement, unknown>('#wires-layer');
    this.tagNodesLayer = d3.select<SVGGElement, unknown>('#tag-nodes-layer');
    this.nodesLayer = d3.select<SVGGElement, unknown>('#nodes-layer');
    this.tempLayer = d3.select<SVGGElement, unknown>('#temp-layer');

    const container = document.getElementById('canvas-container') as HTMLElement | null;
    const height = container?.clientHeight || 600;

    // Track Space key for Pan fallback
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && (document.activeElement as HTMLElement)?.tagName !== 'INPUT') {
        this.isSpacePressed = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
      }
    });

    // Middle-click Pan & Wheel Zoom
    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3])
      .filter((event) => {
        if (this.connectingSourceNode || this.connectingParamPort || this.isMarqueeSelecting) return false;
        if (event.type === 'wheel') return true;
        if (event.button === 1) return true;
        if (event.button === 0 && this.isSpacePressed) return true;
        return false;
      })
      .on('zoom', (event) => {
        this.zoomGroup.attr('transform', event.transform);
        this.callbacks.onZoomChange?.(Math.round(event.transform.k * 100));
      });

    this.svg.call(this.zoomBehavior as any);
    this.svg.call(this.zoomBehavior.transform as any, d3.zoomIdentity.translate(80, height / 2 - 40).scale(0.92));
    this.callbacks.onZoomChange?.(92);

    // Left click on background -> Marquee Selection Box
    this.svg.on('mousedown', (event: MouseEvent) => {
      if (event.button !== 0 || this.isSpacePressed) return;
      const target = event.target as HTMLElement;
      if (target.closest('.blender-node, .tag-node, .socket-pin, .grid-btn, button, input, select')) {
        return;
      }

      this.callbacks.onHidePopover();
      const zoomNode = this.zoomGroup.node();
      if (!zoomNode) return;
      const [mx, my] = d3.pointer(event, zoomNode);

      this.isMarqueeSelecting = true;
      this.marqueeStart = { x: mx, y: my };

      if (!event.shiftKey) {
        this.selectedNodes.clear();
        this.setSelectedTag(null);
        this.setSelectedNode(null);
        this.callbacks.onNodeSelected(null);
      }

      if (this.marqueeRect) this.marqueeRect.remove();
      this.marqueeRect = this.tempLayer.append('rect')
        .attr('class', 'fill-primary/10 stroke-primary stroke-[1.5px] [stroke-dasharray:7_5] pointer-events-none')
        .attr('x', mx)
        .attr('y', my)
        .attr('width', 0)
        .attr('height', 0);
    });

    // Drag-and-drop from palette onto canvas
    this.svg.on('dragover', (e) => e.preventDefault());
    this.svg.on('drop', (event) => {
      event.preventDefault();
      const json = event.dataTransfer?.getData('application/json');
      if (json && this.currentTree) {
        const item: NodeModel = JSON.parse(json);
        const [mx, my] = d3.pointer(event, this.zoomGroup.node());

        const newNode: BtNode = {
          id: crypto.randomUUID(),
          name: item.name,
          category: item.category,
          attributes: {},
          children: [],
          status: NodeStatus.IDLE,
          x: mx,
          y: my
        };

        item.ports.forEach(p => {
          if (p.defaultValue) newNode.attributes[p.name] = p.defaultValue;
        });

        const allNodes = CanvasLayoutService.getAllTreeNodes(this.currentTree);
        const targetContainer = allNodes.find(n => {
          if (!NodeShapeRegistry.isContainer(n)) return false;
          const sw = CanvasLayoutService.getNodeWidth(n);
          const sh = CanvasLayoutService.getNodeHeight(n, this.customModels);
          const sx = n.x ?? 0;
          const sy = n.y ?? 0;
          return (mx >= sx - sw / 2 && mx <= sx + sw / 2 && my >= sy - sh / 2 && my <= sy + sh / 2);
        });

        if (targetContainer) {
          let insertIdx = 0;
          for (const sib of targetContainer.children) {
            if (my > (sib.y ?? 0)) insertIdx++;
          }
          delete (targetContainer as any)._cardHeight;
          delete (targetContainer as any)._slotHeight;
          targetContainer.children.splice(insertIdx, 0, newNode);
          newNode.parent = targetContainer;
        } else if (!this.currentTree.root) {
          this.currentTree.root = newNode;
        } else {
          if (!this.currentTree.floatingNodes) this.currentTree.floatingNodes = [];
          this.currentTree.floatingNodes.push(newNode);
        }

        this.renderGraph(false);
        this.callbacks.onTreeModified();
      }
    });

    // Global mousemove for smooth real-time wire drawing & marquee selection
    window.addEventListener('mousemove', (event: MouseEvent) => {
      const zoomNode = this.zoomGroup.node();
      if (!zoomNode) return;

      // 1. Marquee Selection update
      if (this.isMarqueeSelecting && this.marqueeStart && this.marqueeRect) {
        const [mx, my] = d3.pointer(event, zoomNode);
        const x = Math.min(this.marqueeStart.x, mx);
        const y = Math.min(this.marqueeStart.y, my);
        const w = Math.abs(mx - this.marqueeStart.x);
        const h = Math.abs(my - this.marqueeStart.y);

        this.marqueeRect
          .attr('x', x)
          .attr('y', y)
          .attr('width', w)
          .attr('height', h);

        const allNodes = this.currentTree ? CanvasLayoutService.getAllTreeNodes(this.currentTree) : [];
        allNodes.forEach(cand => {
          const nw = CanvasLayoutService.getNodeWidth(cand);
          const nh = CanvasLayoutService.getNodeHeight(cand, this.customModels);
          const cx = cand.x ?? 0;
          const cy = cand.y ?? 0;
          const isOverlap = !(cx + nw / 2 < x || cx - nw / 2 > x + w || cy + nh / 2 < y || cy - nh / 2 > y + h);
          if (isOverlap) {
            this.selectedNodes.add(cand);
          } else if (!event.shiftKey) {
            this.selectedNodes.delete(cand);
          }
        });

        this.nodesLayer.selectAll<SVGGElement, BtNode>('.blender-node')
          .classed('selected', d => this.selectedNodes.has(d));
      }

      if (!this.connectingSourceNode && !this.connectingParamPort) return;
      const [mx, my] = d3.pointer(event, zoomNode);

      if (this.connectingSourceNode && this.tempWirePath) {
        const sPos = CanvasLayoutService.getSocketCoords(this.connectingSourceNode, this.connectingPortType, this.customModels);
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

    // Global mouseup to complete connections or finish marquee selection
    window.addEventListener('mouseup', (event: MouseEvent) => {
      const zoomNode = this.zoomGroup.node();

      // 1. Parameter socket wire dropped -> Create blackboard TagNode
      if (this.connectingParamPort && this.currentTree) {
        if (zoomNode) {
          const [mx, my] = d3.pointer(event, zoomNode);
          const port = this.connectingParamPort;
          if (!this.currentTree.tagNodes) this.currentTree.tagNodes = [];
          const defaultVal = port.node.attributes[port.portName] || `{${port.portName}}`;
          const model = this.customModels.find(m => m.name === port.node.name);
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
          this.currentTree.tagNodes.push(newTag);
          port.node.attributes[port.portName] = defaultVal;
          this.cleanupParamWire();
          this.renderGraph(false);
          this.callbacks.onTreeModified();
          return;
        }
      }
      this.cleanupParamWire();

      // 2. Execution wire connecting dropped
      if (this.connectingSourceNode && this.currentTree) {
        if (zoomNode) {
          const [mx, my] = d3.pointer(event, zoomNode);
          const srcNode = this.connectingSourceNode;
          const mode = this.connectingMode;
          const portType = this.connectingPortType;
          const allNodes = CanvasLayoutService.getAllTreeNodes(this.currentTree);

          let targetNode: BtNode | null = null;

          // Hit-test: Check if cursor dropped inside or near any node's card boundary
          for (const cand of allNodes) {
            if (cand === srcNode) continue;
            const h = CanvasLayoutService.getNodeHeight(cand, this.customModels);
            const w = CanvasLayoutService.getNodeWidth(cand);
            const cx = cand.x ?? 0;
            const cy = cand.y ?? 0;
            if (mx >= cx - w / 2 - 30 && mx <= cx + w / 2 + 30 &&
                my >= cy - h / 2 - 25 && my <= cy + h / 2 + 25) {
              targetNode = cand;
              break;
            }
          }

          // Proximity snap if dropped near the socket
          if (!targetNode) {
            let minDistance = 120;
            for (const cand of allNodes) {
              if (cand === srcNode) continue;
              const targetPos = mode === 'from-out'
                ? CanvasLayoutService.getSocketCoords(cand, 'in', this.customModels)
                : CanvasLayoutService.getSocketCoords(cand, portType as any, this.customModels);
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
      }

      // 3. Marquee Selection finished
      if (this.isMarqueeSelecting) {
        this.isMarqueeSelecting = false;
        this.marqueeStart = null;
        if (this.marqueeRect) {
          this.marqueeRect.remove();
          this.marqueeRect = null;
        }
        if (this.selectedNodes.size > 0) {
          const first = Array.from(this.selectedNodes)[0];
          this.selectedNode = first;
          this.callbacks.onNodeSelected(first);
          // Set guard so immediate SVG click does not clear selection
          this.justFinishedMarquee = true;
          setTimeout(() => {
            this.justFinishedMarquee = false;
          }, 200);
        }
      }
    });

    // Blank space click clears selection
    this.svg.on('click', (event) => {
      this.callbacks.onHidePopover();
      if (this.justFinishedMarquee) return;
      const target = event.target as HTMLElement;
      if (target.id === 'tree-svg' || target.id === 'viewport-group' || target.id === 'blueprint-grid') {
        this.selectedNode = null;
        this.selectedNodes.clear();
        this.setSelectedTag(null);
        this.callbacks.onNodeSelected(null);
        this.nodesLayer.selectAll('.blender-node').classed('selected', false);
      }
    });
  }

  public setData(tree: BehaviorTree | null, models: NodeModel[]) {
    this.currentTree = tree;
    this.customModels = models;
  }

  public setSelectedNode(node: BtNode | null) {
    this.selectedNode = node;
    this.selectedNodes.clear();
    if (node) this.selectedNodes.add(node);
    this.nodesLayer.selectAll('.blender-node')
      .classed('selected', (d: any) => this.selectedNodes.has(d));
  }

  public getSelectedNode(): BtNode | null {
    return this.selectedNode;
  }

  public getSelectedNodes(): BtNode[] {
    return Array.from(this.selectedNodes);
  }

  public screenToCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
    const zoomNode = this.zoomGroup?.node();
    const svgNode = this.svg?.node();
    if (!zoomNode || !svgNode) return { x: clientX, y: clientY };

    const pt = svgNode.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = zoomNode.getScreenCTM();
    if (ctm) {
      const transformed = pt.matrixTransform(ctm.inverse());
      return { x: Math.round(transformed.x), y: Math.round(transformed.y) };
    }
    return { x: clientX, y: clientY };
  }

  public setSelectedTag(tag: TagNode | null) {
    this.selectedTag = tag;
    if (tag) {
      this.selectedNode = null;
      this.selectedNodes.clear();
      this.nodesLayer.selectAll('.blender-node').classed('selected', false);
      this.callbacks.onNodeSelected(null);
    }
    this.tagNodesLayer.selectAll('g.tag-node')
      .classed('selected', (d: any) => d === tag);
    this.callbacks.onTagSelected?.(tag);
  }

  public getSelectedTag(): TagNode | null {
    return this.selectedTag;
  }

  public deleteSelectedTag(): boolean {
    if (!this.selectedTag || !this.currentTree?.tagNodes) return false;
    const tagToDelete = this.selectedTag;
    const idx = this.currentTree.tagNodes.indexOf(tagToDelete);
    if (idx !== -1) {
      this.currentTree.tagNodes.splice(idx, 1);
      this.selectedTag = null;
      this.renderGraph(false);
      this.callbacks.onTreeModified();
      return true;
    }
    return false;
  }

  public resetView() {
    const container = document.getElementById('canvas-container') as HTMLElement | null;
    const height = container?.clientHeight || 600;

    if (!this.currentTree || !this.currentTree.root) {
      this.svg.transition().duration(400).call(
        this.zoomBehavior.transform as any,
        d3.zoomIdentity.translate(80, height / 2 - 40).scale(0.92)
      );
      return;
    }

    const allNodes = CanvasLayoutService.getAllTreeNodes(this.currentTree);
    if (allNodes.length === 0) return;

    let minY = Infinity, maxY = -Infinity;
    allNodes.forEach(n => {
      const nh = CanvasLayoutService.getNodeHeight(n, this.customModels);
      const y = n.y ?? 0;
      minY = Math.min(minY, y - nh / 2);
      maxY = Math.max(maxY, y + nh / 2);
    });

    const centerY = (minY + maxY) / 2;
    const scale = 0.92;
    const targetY = height / 2 - centerY * scale;

    this.svg.transition().duration(400).call(
      this.zoomBehavior.transform as any,
      d3.zoomIdentity.translate(80, targetY).scale(scale)
    );
  }

  public setZoom(percent: number) {
    if (!this.svg || !this.zoomBehavior) return;
    this.svg.transition().duration(250).call(
      this.zoomBehavior.scaleTo as any,
      percent / 100
    );
  }

  public zoomIn() {
    if (!this.svg || !this.zoomBehavior) return;
    this.svg.transition().duration(200).call(this.zoomBehavior.scaleBy as any, 1.25);
  }

  public zoomOut() {
    if (!this.svg || !this.zoomBehavior) return;
    this.svg.transition().duration(200).call(this.zoomBehavior.scaleBy as any, 0.8);
  }

  public resetZoom() {
    if (!this.svg || !this.zoomBehavior) return;
    const height = this.svg.node()?.getBoundingClientRect().height || 400;
    this.svg.transition().duration(250).call(
      this.zoomBehavior.transform as any,
      d3.zoomIdentity.translate(80, height / 2 - 40).scale(1)
    );
  }

  public computeTreeLayout(root: BtNode) {
    CanvasLayoutService.computeTreeLayout(root, this.customModels, 0);
  }

  public updateAllWires() {
    if (!this.currentTree) return;
    const allNodes = CanvasLayoutService.getAllTreeNodes(this.currentTree);
    const tagNodes = this.currentTree.tagNodes || [];
    WireRenderer.updateAllWires(this.wiresLayer, this.dataWiresLayer, allNodes, tagNodes, this.customModels);
  }

  private showDropIndicator(x1: number, x2: number, y: number) {
    if (!this.dropIndicatorLine) {
      this.dropIndicatorLine = this.tempLayer.append('line')
        .attr('class', 'stroke-blue-500 stroke-[2.5px] stroke-round [stroke-dasharray:7_5] [filter:drop-shadow(0_0_5px_rgba(59,130,246,0.6))] pointer-events-none');
    }
    this.dropIndicatorLine
      .attr('x1', x1)
      .attr('x2', x2)
      .attr('y1', y)
      .attr('y2', y)
      .style('display', 'block');
  }

  private hideDropIndicator() {
    if (this.dropIndicatorLine) {
      this.dropIndicatorLine.remove();
      this.dropIndicatorLine = null;
    }
  }

  public attachNode(parent: BtNode, child: BtNode, portType: 'out' | 'success' | 'failure' = 'out') {
    if (parent === child || !this.currentTree) return;

    // Leaf execution nodes (Action, Condition) cannot accept children in Behavior Trees
    if (parent.category === 'Action' || parent.category === 'Condition') return;

    let cur: BtNode | undefined = parent;
    while (cur) {
      if (cur === child) return;
      cur = cur.parent;
    }

    child.parentPort = portType;

    if (!parent.children.includes(child)) {
      if (child.parent) {
        const oldIdx = child.parent.children.indexOf(child);
        if (oldIdx !== -1) child.parent.children.splice(oldIdx, 1);
      }
      if (this.currentTree.floatingNodes) {
        const fIdx = this.currentTree.floatingNodes.indexOf(child);
        if (fIdx !== -1) this.currentTree.floatingNodes.splice(fIdx, 1);
      }
      parent.children.push(child);
      child.parent = parent;
    }

    if (this.currentTree.root === child) {
      let topAncestor: BtNode = parent;
      while (topAncestor.parent) {
        topAncestor = topAncestor.parent;
      }
      this.currentTree.root = topAncestor;
      if (this.currentTree.floatingNodes) {
        const pIdx = this.currentTree.floatingNodes.indexOf(topAncestor);
        if (pIdx !== -1) this.currentTree.floatingNodes.splice(pIdx, 1);
      }
    }

    this.renderGraph(false);
    this.callbacks.onTreeModified();
  }

  private startConnecting(node: BtNode, mode: 'from-out' | 'from-in', portType: 'success' | 'failure' | 'out' | 'in') {
    this.cleanupTempWire();
    this.connectingSourceNode = node;
    this.connectingMode = mode;
    this.connectingPortType = portType;

    const sPos = CanvasLayoutService.getSocketCoords(node, portType as any, this.customModels);
    const strokeColor = portType === 'failure' ? '#ef4444' : portType === 'success' ? '#22c55e' : '#38bdf8';
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

  private startConnectingParam(node: BtNode, portName: string, portType: string) {
    this.cleanupParamWire();
    const startPos = CanvasLayoutService.getParameterSocketCoords(node, portName, this.customModels);
    const model = this.customModels.find(m => m.name === node.name);
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
      .attr('stroke', isOutput ? '#10b981' : '#38bdf8')
      .attr('stroke-width', '2')
      .attr('stroke-dasharray', '6 4')
      .attr('stroke-linecap', 'round')
      .style('pointer-events', 'none')
      .attr('d', `M ${startPos.x} ${startPos.y} L ${startPos.x} ${startPos.y}`);
  }

  private cleanupTempWire() {
    this.connectingSourceNode = null;
    if (this.tempWirePath) {
      this.tempWirePath.remove();
      this.tempWirePath = null;
    }
  }

  private cleanupParamWire() {
    this.connectingParamPort = null;
    if (this.tempParamWirePath) {
      this.tempParamWirePath.remove();
      this.tempParamWirePath = null;
    }
  }

  private detachSequenceChild(seq: BtNode, child: BtNode, idx: number) {
    if (!this.currentTree) return;
    seq.children.splice(idx, 1);
    delete (seq as any)._cardHeight;
    delete (seq as any)._slotHeight;
    child.parent = undefined;
    child.parentPort = undefined;
    if (!this.currentTree.floatingNodes) this.currentTree.floatingNodes = [];
    if (!this.currentTree.floatingNodes.includes(child)) {
      this.currentTree.floatingNodes.push(child);
    }
    CanvasLayoutService.layoutContainerDirectChildren(seq, this.customModels);
    this.renderGraph(false);
    this.callbacks.onTreeModified();
  }

  public renderGraph(recalculateLayout = false) {
    if (!this.currentTree || (!this.currentTree.root && (!this.currentTree.floatingNodes || this.currentTree.floatingNodes.length === 0))) {
      this.wiresLayer.selectAll('*').remove();
      this.dataWiresLayer.selectAll('*').remove();
      this.nodesLayer.selectAll('*').remove();
      this.tagNodesLayer.selectAll('*').remove();
      return;
    }

    if (recalculateLayout && this.currentTree.root) {
      this.computeTreeLayout(this.currentTree.root);
    }

    const allNodes: BtNode[] = CanvasLayoutService.getAllTreeNodes(this.currentTree);

    allNodes.sort((a, b) => {
      const aCont = NodeShapeRegistry.isContainer(a);
      const bCont = NodeShapeRegistry.isContainer(b);
      if (aCont && !bCont) return -1;
      if (!aCont && bCont) return 1;
      return 0;
    });

    allNodes.forEach((n, idx) => {
      if (n.x === undefined) n.x = 100 + (idx % 4) * 60;
      if (n.y === undefined) n.y = 100 + Math.floor(idx / 4) * 60;
    });

    const links: { source: BtNode; target: BtNode }[] = [];
    allNodes.forEach(n => {
      if (!n.collapsed && n.children && !NodeShapeRegistry.isContainer(n)) {
        n.children.forEach(child => {
          links.push({ source: n, target: child });
        });
      }
    });

    const self = this;

    // 1. WIRES
    WireRenderer.renderExecutionWires(
      this.wiresLayer,
      links,
      this.customModels,
      {
        onDisconnectLink: (parent, child) => {
          if (!self.currentTree) return;
          const idx = parent.children.indexOf(child);
          if (idx !== -1) {
            parent.children.splice(idx, 1);
            child.parent = undefined;
            child.parentPort = undefined;
            if (!self.currentTree.floatingNodes) self.currentTree.floatingNodes = [];
            if (!self.currentTree.floatingNodes.includes(child)) {
              self.currentTree.floatingNodes.push(child);
            }
            self.renderGraph(false);
            self.callbacks.onTreeModified();
          }
        },
        onRemoveTag: () => {},
        onTagSelected: () => {},
        onTagModified: () => {}
      }
    );

    // 2. DATA WIRES & TAG NODES
    const tagNodes = this.currentTree.tagNodes || [];
    WireRenderer.renderDataWires(
      this.dataWiresLayer,
      tagNodes,
      allNodes,
      this.customModels,
      {
        onDisconnectLink: () => {},
        onRemoveTag: (tag) => {
          const idx = tagNodes.indexOf(tag);
          if (idx !== -1) {
            tagNodes.splice(idx, 1);
            self.renderGraph(false);
            self.callbacks.onTreeModified();
          }
        },
        onTagSelected: () => {},
        onTagModified: () => {}
      }
    );

    WireRenderer.renderTagNodes(
      this.tagNodesLayer,
      this.dataWiresLayer,
      tagNodes,
      allNodes,
      this.selectedTag,
      this.customModels,
      {
        onDisconnectLink: () => {},
        onRemoveTag: () => {},
        onTagSelected: (tag) => {
          self.callbacks.onHidePopover();
          self.setSelectedTag(tag);
        },
        onTagModified: () => {
          self.renderGraph(false);
          self.callbacks.onTreeModified();
        }
      }
    );

    // 3. NODES
    const nodeSelection = this.nodesLayer.selectAll<SVGGElement, BtNode>('g.blender-node')
      .data(allNodes, d => d.id);

    nodeSelection.exit().remove();

    const nodeEnter = nodeSelection.enter().append('g')
      .attr('class', 'blender-node')
      .attr('data-id', d => d.id);

    const drag = d3.drag<SVGGElement, BtNode>()
      .filter((event) => {
        if (event.button !== 0 || this.isSpacePressed) return false;
        const target = event.target as HTMLElement;
        if (target.closest('.node-param-select-container, .node-param-select-box, .node-header-btn, .sequence-add-node-btn, .socket-pin')) {
          return false;
        }
        return true;
      })
      .on('start', function (_event, d) {
        (d as any)._dragStartX = d.x ?? 0;
        (d as any)._dragStartY = d.y ?? 0;
        (d as any)._dragAccumDx = 0;
        (d as any)._hasDragMoved = false;
        (d as any)._dragTotalDist = 0;
      })
      .on('drag', function (event, d) {
        (d as any)._dragTotalDist = ((d as any)._dragTotalDist ?? 0) + Math.hypot(event.dx, event.dy);
        if ((d as any)._dragTotalDist > 4) {
          if (!(d as any)._hasDragMoved) {
            (d as any)._hasDragMoved = true;
            if (!NodeShapeRegistry.isContainer(d)) {
              d3.select(this).raise();
            }
          }
        }
        if (!(d as any)._hasDragMoved) {
          return;
        }

        const nodesToMove = (self.selectedNodes.has(d) && self.selectedNodes.size > 1)
          ? Array.from(self.selectedNodes)
          : [d];

        const moveNodeAndDescendants = (node: BtNode, dx: number, dy: number) => {
          node.x = (node.x ?? 0) + dx;
          node.y = (node.y ?? 0) + dy;
          self.nodesLayer.select(`.blender-node[data-id="${node.id}"]`)
            .attr('transform', `translate(${node.x},${node.y})`);

          if (node.children) {
            node.children.forEach(c => moveNodeAndDescendants(c, dx, dy));
          }
        };

        if (d.parent && NodeShapeRegistry.isContainer(d.parent) && nodesToMove.length === 1) {
          const container = d.parent;
          const containerW = CanvasLayoutService.getNodeWidth(container);
          const spineW = CANVAS_CONSTANTS.SPINE_WIDTH;
          const padLeft = 14;
          const childW = CANVAS_CONSTANTS.NODE_WIDTH;
          const lockedX = (container.x ?? 0) - containerW / 2 + spineW + padLeft + childW / 2;

          (d as any)._dragAccumDx = ((d as any)._dragAccumDx ?? 0) + event.dx;
          const isDetaching = Math.abs((d as any)._dragAccumDx) > 130;

          if (isDetaching) {
            self.hideDropIndicator();
            d.x = (d.x ?? lockedX) + event.dx;
            d.y = (d.y ?? 0) + event.dy;
            self.nodesLayer.select(`.blender-node[data-id="${d.id}"]`)
              .attr('transform', `translate(${d.x},${d.y})`)
              .style('opacity', '0.75');
            if (d.children) {
              d.children.forEach(c => moveNodeAndDescendants(c, event.dx, event.dy));
            }
          } else {
            d.x = lockedX;
            d.y = (d.y ?? 0) + event.dy;
            self.nodesLayer.select(`.blender-node[data-id="${d.id}"]`)
              .attr('transform', `translate(${d.x},${d.y})`)
              .style('opacity', '1');

            if (d.children) {
              d.children.forEach(c => moveNodeAndDescendants(c, 0, event.dy));
            }

            const siblings = container.children.filter(c => c !== d);
            let insertIdx = 0;
            for (const sib of siblings) {
              if ((d.y ?? 0) > (sib.y ?? 0)) insertIdx++;
            }

            let indicatorY = 0;
            if (siblings.length === 0) {
              indicatorY = d.y ?? 0;
            } else if (insertIdx === 0) {
              const first = siblings[0];
              indicatorY = (first.y ?? 0) - CanvasLayoutService.getBasicNodeHeight(first, self.customModels) / 2 - 6;
            } else if (insertIdx >= siblings.length) {
              const last = siblings[siblings.length - 1];
              indicatorY = (last.y ?? 0) + CanvasLayoutService.getBasicNodeHeight(last, self.customModels) / 2 + 6;
            } else {
              const prev = siblings[insertIdx - 1];
              const next = siblings[insertIdx];
              indicatorY = ((prev.y ?? 0) + CanvasLayoutService.getBasicNodeHeight(prev, self.customModels) / 2 + (next.y ?? 0) - CanvasLayoutService.getBasicNodeHeight(next, self.customModels) / 2) / 2;
            }

            self.showDropIndicator(lockedX - childW / 2, lockedX + childW / 2, indicatorY);
          }
        } else {
          nodesToMove.forEach(curr => {
            if (NodeShapeRegistry.isContainer(curr)) {
              moveNodeAndDescendants(curr, event.dx, event.dy);
            } else {
              curr.x = (curr.x ?? 0) + event.dx;
              curr.y = (curr.y ?? 0) + event.dy;
              self.nodesLayer.select(`.blender-node[data-id="${curr.id}"]`)
                .attr('transform', `translate(${curr.x},${curr.y})`);
              if (curr.children) {
                curr.children.forEach(c => moveNodeAndDescendants(c, event.dx, event.dy));
              }
            }
          });

          // Check if single dragged node is hovering over a container node
          if (nodesToMove.length === 1 && !NodeShapeRegistry.isContainer(d) && self.currentTree) {
            const allNodes = CanvasLayoutService.getAllTreeNodes(self.currentTree);
            const hoverContainer = allNodes.find(n => {
              if (!NodeShapeRegistry.isContainer(n) || n === d) return false;
              const sw = CanvasLayoutService.getNodeWidth(n);
              const sh = CanvasLayoutService.getNodeHeight(n, self.customModels);
              const sx = n.x ?? 0;
              const sy = n.y ?? 0;
              return ((d.x ?? 0) >= sx - sw / 2 && (d.x ?? 0) <= sx + sw / 2 &&
                      (d.y ?? 0) >= sy - sh / 2 && (d.y ?? 0) <= sy + sh / 2);
            });

            if (hoverContainer) {
              const spineW = CANVAS_CONSTANTS.SPINE_WIDTH;
              const padLeft = 14;
              const childW = CANVAS_CONSTANTS.NODE_WIDTH;
              const lockedX = (hoverContainer.x ?? 0) - CanvasLayoutService.getNodeWidth(hoverContainer) / 2 + spineW + padLeft + childW / 2;
              const siblings = hoverContainer.children || [];
              let insertIdx = 0;
              for (const sib of siblings) {
                if ((d.y ?? 0) > (sib.y ?? 0)) insertIdx++;
              }

              let indicatorY = 0;
              if (siblings.length === 0) {
                indicatorY = d.y ?? 0;
              } else if (insertIdx === 0) {
                const first = siblings[0];
                indicatorY = (first.y ?? 0) - CanvasLayoutService.getBasicNodeHeight(first, self.customModels) / 2 - 6;
              } else if (insertIdx >= siblings.length) {
                const last = siblings[siblings.length - 1];
                indicatorY = (last.y ?? 0) + CanvasLayoutService.getBasicNodeHeight(last, self.customModels) / 2 + 6;
              } else {
                const prev = siblings[insertIdx - 1];
                const next = siblings[insertIdx];
                indicatorY = ((prev.y ?? 0) + CanvasLayoutService.getBasicNodeHeight(prev, self.customModels) / 2 + (next.y ?? 0) - CanvasLayoutService.getBasicNodeHeight(next, self.customModels) / 2) / 2;
              }

              self.showDropIndicator(lockedX - childW / 2, lockedX + childW / 2, indicatorY);
            } else {
              self.hideDropIndicator();
            }
          }
        }

        self.updateAllWires();
      })
      .on('end', function (_event, d) {
        self.hideDropIndicator();
        self.nodesLayer.select(`.blender-node[data-id="${d.id}"]`).style('opacity', '1');

        if (!(d as any)._hasDragMoved) {
          const isShift = (_event.sourceEvent && _event.sourceEvent.shiftKey) || (_event as any).shiftKey;
          if (isShift) {
            if (self.selectedNodes.has(d)) {
              self.selectedNodes.delete(d);
              const remaining = Array.from(self.selectedNodes);
              self.selectedNode = remaining.length > 0 ? remaining[0] : null;
            } else {
              self.selectedNodes.add(d);
              self.selectedNode = d;
            }
            self.nodesLayer.selectAll('.blender-node')
              .classed('selected', (n: any) => self.selectedNodes.has(n));
            self.callbacks.onNodeSelected(self.selectedNode);
          } else {
            self.setSelectedNode(d);
            self.callbacks.onNodeSelected(d);
          }
          return;
        }

        self.nodesLayer.selectAll<SVGGElement, BtNode>('.blender-node').order();

        if (!self.currentTree) return;

        if (d.parent && NodeShapeRegistry.isContainer(d.parent)) {
          const container = d.parent;
          const isDetaching = Math.abs(((d as any)._dragAccumDx ?? 0)) > 130;

          if (isDetaching) {
            const idx = container.children.indexOf(d);
            if (idx !== -1) container.children.splice(idx, 1);
            delete (container as any)._cardHeight;
            delete (container as any)._slotHeight;
            d.parent = undefined;
            d.parentPort = undefined;
            if (!self.currentTree.floatingNodes) self.currentTree.floatingNodes = [];
            if (!self.currentTree.floatingNodes.includes(d)) {
              self.currentTree.floatingNodes.push(d);
            }
            CanvasLayoutService.layoutContainerDirectChildren(container, self.customModels);
            self.renderGraph(false);
            self.callbacks.onTreeModified();
            return;
          } else {
            const siblings = container.children.filter(c => c !== d);
            let insertIdx = 0;
            for (const sib of siblings) {
              if ((d.y ?? 0) > (sib.y ?? 0)) insertIdx++;
            }
            const oldIdx = container.children.indexOf(d);
            if (oldIdx !== -1) container.children.splice(oldIdx, 1);
            container.children.splice(insertIdx, 0, d);
            delete (container as any)._cardHeight;
            delete (container as any)._slotHeight;
            CanvasLayoutService.layoutContainerDirectChildren(container, self.customModels);
            self.renderGraph(false);
            self.callbacks.onTreeModified();
            return;
          }
        }

        const allNodes = CanvasLayoutService.getAllTreeNodes(self.currentTree);
        const containers = allNodes.filter(n => NodeShapeRegistry.isContainer(n) && n !== d);
        for (const container of containers) {
          const sw = CanvasLayoutService.getNodeWidth(container);
          const sh = CanvasLayoutService.getNodeHeight(container, self.customModels);
          const sx = container.x ?? 0;
          const sy = container.y ?? 0;
          const dx = d.x ?? 0;
          const dy = d.y ?? 0;
          if (dx >= sx - sw / 2 - 25 && dx <= sx + sw / 2 + 25 &&
              dy >= sy - sh / 2 - 20 && dy <= sy + sh / 2 + 20) {
            
            let insertIdx = 0;
            const siblings = container.children || [];
            for (const sib of siblings) {
              if (dy > (sib.y ?? 0)) insertIdx++;
            }

            if (d.parent) {
              const oldIdx = d.parent.children.indexOf(d);
              if (oldIdx !== -1) d.parent.children.splice(oldIdx, 1);
              delete (d.parent as any)._cardHeight;
              delete (d.parent as any)._slotHeight;
            }
            if (self.currentTree.floatingNodes) {
              const fIdx = self.currentTree.floatingNodes.indexOf(d);
              if (fIdx !== -1) self.currentTree.floatingNodes.splice(fIdx, 1);
            }

            // If the dragged node was root, make the container's topmost ancestor the new root
            if (self.currentTree.root === d) {
              let topAncestor: BtNode = container;
              while (topAncestor.parent) {
                topAncestor = topAncestor.parent;
              }
              self.currentTree.root = topAncestor;
            }

            d.parent = container;
            d.parentPort = undefined;
            if (!container.children) container.children = [];
            container.children.splice(insertIdx, 0, d);
            delete (container as any)._cardHeight;
            delete (container as any)._slotHeight;

            CanvasLayoutService.layoutContainerDirectChildren(container, self.customModels);
            self.renderGraph(false);
            self.callbacks.onTreeModified();
            break;
          }
        }
      });

    const nodeMerge = nodeEnter.merge(nodeSelection as any);
    nodeMerge.order();
    nodeMerge.call(drag as any);

    NodeRenderer.renderNodes(nodeMerge, this.customModels, {
      onShowPortSelect: (node, portName, triggerRect) => {
        this.callbacks.onShowPortPopover(node, portName, triggerRect);
      },
      onStartConnecting: (node, mode, portType) => {
        this.startConnecting(node, mode, portType);
      },
      onStartConnectingParam: (node, portName, portType) => {
        this.startConnectingParam(node, portName, portType);
      },
      onDetachSequenceChild: (seq, child, idx) => {
        this.detachSequenceChild(seq, child, idx);
      },
      onNodeAddedToSequence: (seq, newNode) => {
        CanvasLayoutService.layoutContainerDirectChildren(seq, this.customModels);
        this.renderGraph(false);
        this.callbacks.onTreeModified();
        this.setSelectedNode(newNode);
      }
    });
    nodeMerge.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
      .attr('class', d => {
        let cls = 'blender-node';
        if (this.selectedNode?.id === d.id) cls += ' selected';
        if (d.status === NodeStatus.RUNNING) cls += ' running';
        else if (d.status === NodeStatus.SUCCESS) cls += ' success';
        else if (d.status === NodeStatus.FAILURE) cls += ' failure';
        return cls;
      });

    nodeMerge.select('.order-badge-text')
      .text(d => {
        if (!d.parent) return 'ROOT';
        const siblingIndex = d.parent.children.indexOf(d) + 1;
        return `#${siblingIndex}`;
      });

    nodeMerge.each(function (d) {
      const g = d3.select(this);
      g.select('.node-custom-name')
        .text(d.customName && d.customName !== d.name ? d.customName : '');

      const model = self.customModels.find(m => m.name === d.name);
      const ports = model?.ports || [];
      ports.forEach(p => {
        const val = d.attributes[p.name] ?? p.defaultValue ?? '';
        g.selectAll(`.node-param-select-label[data-port-name="${p.name}"]`)
          .text(val.length > 11 ? val.substring(0, 9) + '..' : (val || 'set val'));
      });
    });

    nodeMerge.on('click', (event, d) => {
      event.stopPropagation();
      this.setSelectedNode(d);
      this.callbacks.onNodeSelected(d);
    });
  }
}
