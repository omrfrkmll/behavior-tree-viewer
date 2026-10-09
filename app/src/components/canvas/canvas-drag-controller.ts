import * as d3 from 'd3';
import { BehaviorTree, BtNode, NodeModel, NodeStatus } from '../../types';
import { CanvasLayoutService, CANVAS_CONSTANTS } from './canvas-layout';
import { NodeShapeRegistry } from './nodes';
import { CanvasSelectionManager } from './canvas-selection-manager';

export interface DragControllerOptions {
  svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  zoomGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  nodesLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  tempLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  selectionManager: CanvasSelectionManager;
  getTree: () => BehaviorTree | null;
  getCustomModels: () => NodeModel[];
  getIsSpacePressed: () => boolean;
  onUpdateWires: () => void;
  onRenderGraph: (recalculateLayout: boolean) => void;
  onTreeModified: () => void;
  onNodeSelected: (node: BtNode | null) => void;
}

export class CanvasDragController {
  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private zoomGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private nodesLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private tempLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private selectionManager: CanvasSelectionManager;
  private getTree: () => BehaviorTree | null;
  private getCustomModels: () => NodeModel[];
  private getIsSpacePressed: () => boolean;
  private onUpdateWires: () => void;
  private onRenderGraph: (recalculateLayout: boolean) => void;
  private onTreeModified: () => void;
  private onNodeSelected: (node: BtNode | null) => void;

  private dropIndicatorLine: d3.Selection<SVGLineElement, unknown, HTMLElement, any> | null = null;

  constructor(options: DragControllerOptions) {
    this.svg = options.svg;
    this.zoomGroup = options.zoomGroup;
    this.nodesLayer = options.nodesLayer;
    this.tempLayer = options.tempLayer;
    this.selectionManager = options.selectionManager;
    this.getTree = options.getTree;
    this.getCustomModels = options.getCustomModels;
    this.getIsSpacePressed = options.getIsSpacePressed;
    this.onUpdateWires = options.onUpdateWires;
    this.onRenderGraph = options.onRenderGraph;
    this.onTreeModified = options.onTreeModified;
    this.onNodeSelected = options.onNodeSelected;

    this.initPaletteDrop();
  }

  public showDropIndicator(x1: number, x2: number, y: number) {
    if (!this.dropIndicatorLine) {
      this.dropIndicatorLine = this.tempLayer.append('line')
        .attr('class', 'stroke-primary stroke-[2.5px] pointer-events-none')
        .attr('stroke-linecap', 'round');
    }
    this.dropIndicatorLine
      .attr('x1', x1)
      .attr('x2', x2)
      .attr('y1', y)
      .attr('y2', y)
      .style('display', 'block');
  }

  public hideDropIndicator() {
    if (this.dropIndicatorLine) {
      this.dropIndicatorLine.style('display', 'none');
    }
  }

  public getNodeDepth(node: BtNode): number {
    let depth = 0;
    let curr = node.parent;
    while (curr) {
      depth++;
      curr = curr.parent;
    }
    return depth;
  }

  public isDescendantOf(candidate: BtNode, ancestor: BtNode): boolean {
    let curr: BtNode | undefined = candidate;
    while (curr) {
      if (curr === ancestor) {
        return true;
      }
      curr = curr.parent;
    }
    return false;
  }

  public findTargetContainer(
    x: number,
    y: number,
    draggedNode?: BtNode
  ): BtNode | null {
    const tree = this.getTree();
    if (!tree) {
      return null;
    }
    const customModels = this.getCustomModels();
    const allNodes = CanvasLayoutService.getAllTreeNodes(tree);

    const candidates = allNodes.filter(n => {
      if (!NodeShapeRegistry.isContainer(n)) {
        return false;
      }
      if (draggedNode) {
        if (n === draggedNode || this.isDescendantOf(n, draggedNode)) {
          return false;
        }
      }
      const sw = CanvasLayoutService.getNodeWidth(n);
      const sh = CanvasLayoutService.getNodeHeight(n, customModels);
      const sx = n.x ?? 0;
      const sy = n.y ?? 0;
      return (
        x >= sx - sw / 2 - 20 &&
        x <= sx + sw / 2 + 20 &&
        y >= sy - sh / 2 - 20 &&
        y <= sy + sh / 2 + 20
      );
    });

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => this.getNodeDepth(b) - this.getNodeDepth(a));
    return candidates[0];
  }

  public getContainerInsertSlot(
    container: BtNode,
    y: number,
    draggedNode?: BtNode
  ): { insertIdx: number; indicatorY: number; lineX1: number; lineX2: number } {
    const customModels = this.getCustomModels();
    const siblings = (container.children || []).filter(c => c !== draggedNode);
    const containerW = CanvasLayoutService.getNodeWidth(container);
    const containerH = CanvasLayoutService.getNodeHeight(container, customModels);
    const containerX = container.x ?? 0;
    const containerY = container.y ?? 0;

    const spineW = CANVAS_CONSTANTS.SPINE_WIDTH;
    const padLeft = CANVAS_CONSTANTS.SEQUENCE_PAD_LEFT;
    const padRight = CANVAS_CONSTANTS.SEQUENCE_PAD_RIGHT;
    const lineX1 = containerX - containerW / 2 + spineW + padLeft;
    const lineX2 = containerX + containerW / 2 - padRight;

    let insertIdx = 0;
    for (const sib of siblings) {
      if (y > (sib.y ?? 0)) {
        insertIdx++;
      }
    }

    let indicatorY = 0;
    if (siblings.length === 0) {
      indicatorY = containerY - containerH / 2 + CANVAS_CONSTANTS.SEQUENCE_HEADER_H + CANVAS_CONSTANTS.SEQUENCE_PAD_TOP + 18;
    } else if (insertIdx === 0) {
      const first = siblings[0];
      const firstH = CanvasLayoutService.getNodeHeight(first, customModels);
      indicatorY = (first.y ?? 0) - firstH / 2 - CANVAS_CONSTANTS.SEQUENCE_CHILD_GAP / 2;
    } else if (insertIdx >= siblings.length) {
      const last = siblings[siblings.length - 1];
      const lastH = CanvasLayoutService.getNodeHeight(last, customModels);
      indicatorY = (last.y ?? 0) + lastH / 2 + CANVAS_CONSTANTS.SEQUENCE_CHILD_GAP / 2;
    } else {
      const prev = siblings[insertIdx - 1];
      const next = siblings[insertIdx];
      const prevH = CanvasLayoutService.getNodeHeight(prev, customModels);
      const nextH = CanvasLayoutService.getNodeHeight(next, customModels);
      indicatorY = ((prev.y ?? 0) + prevH / 2 + (next.y ?? 0) - nextH / 2) / 2;
    }

    return { insertIdx, indicatorY, lineX1, lineX2 };
  }

  public createNodeDragBehavior(): d3.DragBehavior<SVGGElement, BtNode, unknown> {
    const self = this;

    return d3.drag<SVGGElement, BtNode>()
      .filter((event) => {
        if (event.button !== 0 || this.getIsSpacePressed()) {
          return false;
        }
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
            d3.select(this).raise();
          }
        }
        if (!(d as any)._hasDragMoved) {
          return;
        }

        const selectedNodes = self.selectionManager.getSelectedNodes();
        const rawNodesToMove = (selectedNodes.includes(d) && selectedNodes.length > 1)
          ? selectedNodes
          : [d];

        // Only move top-level roots among selected nodes. Any descendant of an ancestor
        // already being moved will be moved naturally with its ancestor, avoiding 2x displacement.
        const rootsToMove = rawNodesToMove.filter(node => {
          return !rawNodesToMove.some(other => other !== node && self.isDescendantOf(node, other));
        });

        const visited = new Set<string>();
        const moveNodeAndDescendants = (node: BtNode, dx: number, dy: number) => {
          if (visited.has(node.id)) return;
          visited.add(node.id);

          node.x = (node.x ?? 0) + dx;
          node.y = (node.y ?? 0) + dy;
          self.nodesLayer.select(`.blender-node[data-id="${node.id}"]`)
            .attr('transform', `translate(${node.x},${node.y})`);

          if (node.children) {
            node.children.forEach(c => moveNodeAndDescendants(c, dx, dy));
          }
        };

        rootsToMove.forEach(curr => {
          moveNodeAndDescendants(curr, event.dx, event.dy);
        });

        if (rawNodesToMove.length === 1) {
          const hoverContainer = self.findTargetContainer(d.x ?? 0, d.y ?? 0, d);
          if (hoverContainer) {
            const { indicatorY, lineX1, lineX2 } = self.getContainerInsertSlot(hoverContainer, d.y ?? 0, d);
            self.showDropIndicator(lineX1, lineX2, indicatorY);
          } else {
            self.hideDropIndicator();
          }
        } else {
          self.hideDropIndicator();
        }

        self.onUpdateWires();
      })
      .on('end', function (_event, d) {
        self.hideDropIndicator();
        self.nodesLayer.select(`.blender-node[data-id="${d.id}"]`).style('opacity', '1');

        if (!(d as any)._hasDragMoved) {
          const isShift = (_event.sourceEvent && _event.sourceEvent.shiftKey) || (_event as any).shiftKey;
          if (isShift) {
            const currentSelected = self.selectionManager.getSelectedNodes();
            if (currentSelected.includes(d)) {
              const remaining = currentSelected.filter(n => n !== d);
              self.selectionManager.setSelectedNode(remaining.length > 0 ? remaining[0] : null);
            } else {
              self.selectionManager.setSelectedNode(d);
            }
          } else {
            self.selectionManager.setSelectedNode(d);
            self.onNodeSelected(d);
          }
          return;
        }

        self.nodesLayer.selectAll<SVGGElement, BtNode>('.blender-node').order();

        const tree = self.getTree();
        const customModels = self.getCustomModels();
        if (!tree) {
          return;
        }

        const selectedNodes = self.selectionManager.getSelectedNodes();
        const isMultiDrag = selectedNodes.includes(d) && selectedNodes.length > 1;

        if (isMultiDrag) {
          self.onUpdateWires();
          self.onTreeModified();
          return;
        }

        const targetContainer = self.findTargetContainer(d.x ?? 0, d.y ?? 0, d);
        const oldParent = d.parent;

        if (targetContainer) {
          const { insertIdx } = self.getContainerInsertSlot(targetContainer, d.y ?? 0, d);

          if (oldParent) {
            const oldIdx = oldParent.children.indexOf(d);
            if (oldIdx !== -1) {
              oldParent.children.splice(oldIdx, 1);
            }
          }
          if (tree.floatingNodes) {
            const fIdx = tree.floatingNodes.indexOf(d);
            if (fIdx !== -1) {
              tree.floatingNodes.splice(fIdx, 1);
            }
          }

          if (tree.root === d) {
            let topAncestor: BtNode = targetContainer;
            while (topAncestor.parent) {
              topAncestor = topAncestor.parent;
            }
            tree.root = topAncestor;
          }

          d.parent = targetContainer;
          d.parentPort = undefined;
          if (!targetContainer.children) {
            targetContainer.children = [];
          }
          targetContainer.children.splice(insertIdx, 0, d);

          CanvasLayoutService.relayoutTree(targetContainer, customModels);
          if (oldParent && oldParent !== targetContainer) {
            CanvasLayoutService.relayoutTree(oldParent, customModels);
          }

          self.onRenderGraph(false);
          self.onTreeModified();
        } else {
          if (oldParent && NodeShapeRegistry.isContainer(oldParent)) {
            const oldIdx = oldParent.children.indexOf(d);
            if (oldIdx !== -1) {
              oldParent.children.splice(oldIdx, 1);
            }
            d.parent = undefined;
            d.parentPort = undefined;
            if (!tree.floatingNodes) {
              tree.floatingNodes = [];
            }
            if (!tree.floatingNodes.includes(d)) {
              tree.floatingNodes.push(d);
            }

            CanvasLayoutService.relayoutTree(oldParent, customModels);
            self.onRenderGraph(false);
            self.onTreeModified();
          } else {
            self.onUpdateWires();
            self.onTreeModified();
          }
        }
      });
  }

  private initPaletteDrop() {
    this.svg.on('dragover', (e) => e.preventDefault());
    this.svg.on('drop', (event) => {
      event.preventDefault();
      const json = event.dataTransfer?.getData('application/json');
      const tree = this.getTree();
      const customModels = this.getCustomModels();
      const zoomNode = this.zoomGroup.node();
      if (json && tree && zoomNode) {
        const item: NodeModel = JSON.parse(json);
        const [mx, my] = d3.pointer(event, zoomNode);

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
          if (p.defaultValue) {
            newNode.attributes[p.name] = p.defaultValue;
          }
        });

        const targetContainer = this.findTargetContainer(mx, my);

        if (targetContainer) {
          const { insertIdx } = this.getContainerInsertSlot(targetContainer, my);
          delete (targetContainer as any)._cardHeight;
          delete (targetContainer as any)._slotHeight;
          if (!targetContainer.children) {
            targetContainer.children = [];
          }
          targetContainer.children.splice(insertIdx, 0, newNode);
          newNode.parent = targetContainer;

          CanvasLayoutService.relayoutTree(targetContainer, customModels);
          this.onRenderGraph(false);
          this.onTreeModified();
          this.onNodeSelected(newNode);
          this.selectionManager.setSelectedNode(newNode);
        } else if (!tree.root) {
          tree.root = newNode;
          this.onRenderGraph(false);
          this.onTreeModified();
          this.onNodeSelected(newNode);
          this.selectionManager.setSelectedNode(newNode);
        } else {
          if (!tree.floatingNodes) {
            tree.floatingNodes = [];
          }
          tree.floatingNodes.push(newNode);
          this.onRenderGraph(false);
          this.onTreeModified();
          this.onNodeSelected(newNode);
          this.selectionManager.setSelectedNode(newNode);
        }
      }
    });
  }
}
