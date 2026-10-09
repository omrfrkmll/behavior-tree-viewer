import * as d3 from 'd3';
import { BehaviorTree, BtNode, NodeModel, NodeStatus, TagNode } from '../../types';
import { CanvasLayoutService } from './canvas-layout';
import { NodeRenderer, NodeShapeRegistry } from './nodes';
import { WireRenderer } from './wire-renderer';
import { CanvasViewerCallbacks, GridMode } from './canvas-types';
import { CanvasViewportManager } from './canvas-viewport-manager';
import { CanvasSelectionManager } from './canvas-selection-manager';
import { CanvasConnectionManager } from './canvas-connection-manager';
import { CanvasDragController } from './canvas-drag-controller';

export type { CanvasViewerCallbacks, GridMode } from './canvas-types';

export class CanvasViewerComponent {
  private svg!: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private zoomGroup!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private wiresLayer!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private dataWiresLayer!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private nodesLayer!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private tagNodesLayer!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private tempLayer!: d3.Selection<SVGGElement, unknown, HTMLElement, any>;

  // Sub-managers
  private viewportManager!: CanvasViewportManager;
  private selectionManager!: CanvasSelectionManager;
  private connectionManager!: CanvasConnectionManager;
  private dragController!: CanvasDragController;

  private currentTree: BehaviorTree | null = null;
  private customModels: NodeModel[] = [];

  constructor(private callbacks: CanvasViewerCallbacks) {
    this.initLayers();
    this.initManagers();
  }

  private initLayers() {
    this.svg = d3.select<SVGSVGElement, unknown>('#tree-svg');
    this.zoomGroup = d3.select<SVGGElement, unknown>('#viewport-group');
    this.dataWiresLayer = d3.select<SVGGElement, unknown>('#data-wires-layer');
    this.wiresLayer = d3.select<SVGGElement, unknown>('#wires-layer');
    this.tagNodesLayer = d3.select<SVGGElement, unknown>('#tag-nodes-layer');
    this.nodesLayer = d3.select<SVGGElement, unknown>('#nodes-layer');
    this.tempLayer = d3.select<SVGGElement, unknown>('#temp-layer');
  }

  private initManagers() {
    this.viewportManager = new CanvasViewportManager({
      svg: this.svg,
      zoomGroup: this.zoomGroup,
      onZoomChange: (percent) => this.callbacks.onZoomChange?.(percent),
      isInteractingPredicate: () => {
        return Boolean(
          this.connectionManager?.isConnecting() ||
          this.selectionManager?.getIsMarqueeSelecting()
        );
      }
    });

    this.selectionManager = new CanvasSelectionManager({
      svg: this.svg,
      zoomGroup: this.zoomGroup,
      nodesLayer: this.nodesLayer,
      tagNodesLayer: this.tagNodesLayer,
      onNodeSelected: (node) => this.callbacks.onNodeSelected(node),
      onTagSelected: (tag) => this.callbacks.onTagSelected?.(tag),
      onTreeModified: () => this.callbacks.onTreeModified(),
      onHidePopover: () => this.callbacks.onHidePopover(),
      getTree: () => this.currentTree,
      getCustomModels: () => this.customModels,
      getIsSpacePressed: () => this.viewportManager.getIsSpacePressed(),
      onRenderGraph: (recalc) => {
        this.renderGraph(recalc);
        this.callbacks.onTreeModified();
      }
    });

    this.connectionManager = new CanvasConnectionManager({
      zoomGroup: this.zoomGroup,
      tempLayer: this.tempLayer,
      getTree: () => this.currentTree,
      getCustomModels: () => this.customModels,
      onTreeModified: () => this.callbacks.onTreeModified(),
      onRenderGraph: (recalc) => this.renderGraph(recalc)
    });

    this.dragController = new CanvasDragController({
      svg: this.svg,
      zoomGroup: this.zoomGroup,
      nodesLayer: this.nodesLayer,
      tempLayer: this.tempLayer,
      selectionManager: this.selectionManager,
      getTree: () => this.currentTree,
      getCustomModels: () => this.customModels,
      getIsSpacePressed: () => this.viewportManager.getIsSpacePressed(),
      onUpdateWires: () => this.updateAllWires(),
      onRenderGraph: (recalc) => this.renderGraph(recalc),
      onTreeModified: () => this.callbacks.onTreeModified(),
      onNodeSelected: (node) => this.callbacks.onNodeSelected(node)
    });
  }

  // --- Public Viewport & Grid API ---

  public setGridMode(mode: GridMode) {
    this.viewportManager.setGridMode(mode);
  }

  public setZoom(percent: number) {
    this.viewportManager.setZoom(percent);
  }

  public zoomIn() {
    this.viewportManager.zoomIn();
  }

  public zoomOut() {
    this.viewportManager.zoomOut();
  }

  public resetZoom() {
    this.viewportManager.resetZoom();
  }

  public resetView() {
    this.viewportManager.resetView(this.currentTree, this.customModels);
  }

  public screenToCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
    return this.viewportManager.screenToCanvasCoords(clientX, clientY);
  }

  // --- Public Tree & Selection API ---

  public setData(tree: BehaviorTree | null, models: NodeModel[]) {
    this.currentTree = tree;
    this.customModels = models;
  }

  public setSelectedNode(node: BtNode | null) {
    this.selectionManager.setSelectedNode(node);
  }

  public getSelectedNode(): BtNode | null {
    return this.selectionManager.getSelectedNode();
  }

  public getSelectedNodes(): BtNode[] {
    return this.selectionManager.getSelectedNodes();
  }

  public setSelectedTag(tag: TagNode | null) {
    this.selectionManager.setSelectedTag(tag);
  }

  public getSelectedTag(): TagNode | null {
    return this.selectionManager.getSelectedTag();
  }

  public getSelectedTags(): TagNode[] {
    return this.selectionManager.getSelectedTags();
  }

  public deleteSelectedTag(): boolean {
    return this.selectionManager.deleteSelectedTag();
  }

  public deleteSelectedTags(): boolean {
    return this.selectionManager.deleteSelectedTags();
  }

  public computeTreeLayout(root: BtNode) {
    CanvasLayoutService.computeTreeLayout(root, this.customModels);
  }

  public attachNode(parent: BtNode, child: BtNode, portType: 'out' | 'success' | 'failure' = 'out') {
    this.connectionManager.attachNode(parent, child, portType);
  }

  public updateAllWires() {
    if (!this.currentTree) {
      return;
    }
    const allNodes = CanvasLayoutService.getAllTreeNodes(this.currentTree);
    const tagNodes = this.currentTree.tagNodes || [];
    WireRenderer.updateAllWires(
      this.wiresLayer,
      this.dataWiresLayer,
      allNodes,
      tagNodes,
      this.customModels
    );
  }

  // --- Rendering Pipeline ---

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

    const getDepth = (n: BtNode): number => {
      let d = 0;
      let curr = n.parent;
      while (curr) {
        d++;
        curr = curr.parent;
      }
      return d;
    };

    allNodes.sort((a, b) => {
      const aCont = NodeShapeRegistry.isContainer(a);
      const bCont = NodeShapeRegistry.isContainer(b);
      if (aCont && !bCont) {
        return -1;
      }
      if (!aCont && bCont) {
        return 1;
      }
      return getDepth(a) - getDepth(b);
    });

    allNodes.forEach((n, idx) => {
      if (n.x === undefined) {
        n.x = 100 + (idx % 4) * 60;
      }
      if (n.y === undefined) {
        n.y = 100 + Math.floor(idx / 4) * 60;
      }
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

    // 1. EXECUTION WIRES
    WireRenderer.renderExecutionWires(
      this.wiresLayer,
      links,
      this.customModels,
      {
        onDisconnectLink: (parent, child) => {
          if (!self.currentTree) {
            return;
          }
          const idx = parent.children.indexOf(child);
          if (idx !== -1) {
            parent.children.splice(idx, 1);
            child.parent = undefined;
            child.parentPort = undefined;
            if (!self.currentTree.floatingNodes) {
              self.currentTree.floatingNodes = [];
            }
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
      new Set(this.selectionManager.getSelectedTags()),
      this.customModels,
      {
        onDisconnectLink: () => {},
        onRemoveTag: () => {},
        onTagSelected: (tag) => {
          self.callbacks.onHidePopover();
          self.selectionManager.setSelectedTag(tag);
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

    const drag = this.dragController.createNodeDragBehavior();
    const nodeMerge = nodeEnter.merge(nodeSelection as any);
    nodeMerge.order();
    nodeMerge.call(drag as any);

    NodeRenderer.renderNodes(nodeMerge, this.customModels, {
      onShowPortSelect: (node, portName, triggerRect) => {
        this.callbacks.onShowPortPopover(node, portName, triggerRect);
      },
      onStartConnecting: (node, mode, portType) => {
        this.connectionManager.startConnecting(node, mode, portType);
      },
      onStartConnectingParam: (node, portName, portType) => {
        this.connectionManager.startConnectingParam(node, portName, portType);
      },
      onDetachSequenceChild: (seq, child, idx) => {
        this.connectionManager.detachSequenceChild(seq, child, idx);
      },
      onNodeAddedToSequence: (seq, newNode) => {
        CanvasLayoutService.relayoutTree(seq, this.customModels);
        this.renderGraph(false);
        this.callbacks.onTreeModified();
        this.setSelectedNode(newNode);
      }
    });

    nodeMerge.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
      .attr('class', d => {
        let cls = 'blender-node';
        if (this.selectionManager.getSelectedNode()?.id === d.id) {
          cls += ' selected';
        }
        if (d.status === NodeStatus.RUNNING) {
          cls += ' running';
        } else if (d.status === NodeStatus.SUCCESS) {
          cls += ' success';
        } else if (d.status === NodeStatus.FAILURE) {
          cls += ' failure';
        }
        return cls;
      });

    nodeMerge.select('.order-badge-text')
      .text(d => {
        if (!d.parent) {
          return 'ROOT';
        }
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
      this.selectionManager.setSelectedNode(d);
      this.callbacks.onNodeSelected(d);
    });

    this.selectionManager.updateVisualSelection();
  }
}
