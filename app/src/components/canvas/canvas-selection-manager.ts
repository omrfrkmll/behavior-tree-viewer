import * as d3 from 'd3';
import { BehaviorTree, BtNode, NodeModel, TagNode } from '../../types';
import { CanvasLayoutService } from './canvas-layout';

export interface SelectionManagerOptions {
  svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  zoomGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  nodesLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  tagNodesLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  onNodeSelected: (node: BtNode | null) => void;
  onTagSelected?: (tag: TagNode | null) => void;
  onTreeModified?: () => void;
  onHidePopover: () => void;
  getTree: () => BehaviorTree | null;
  getCustomModels: () => NodeModel[];
  getIsSpacePressed: () => boolean;
  onRenderGraph: (recalculateLayout: boolean) => void;
}

export class CanvasSelectionManager {
  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private zoomGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private nodesLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private tagNodesLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private onNodeSelected: (node: BtNode | null) => void;
  private onTagSelected?: (tag: TagNode | null) => void;
  private onHidePopover: () => void;
  private getTree: () => BehaviorTree | null;
  private getCustomModels: () => NodeModel[];
  private getIsSpacePressed: () => boolean;
  private onRenderGraph: (recalculateLayout: boolean) => void;

  // Selection states
  private selectedNodes: Set<BtNode> = new Set();
  private selectedTags: Set<TagNode> = new Set();
  private selectedNode: BtNode | null = null;

  // Marquee selection states
  private isMarqueeSelecting = false;
  private justFinishedMarquee = false;
  private marqueeStartScreen: { x: number; y: number } | null = null;
  private marqueeStartCanvas: { x: number; y: number } | null = null;
  private marqueeRect: d3.Selection<SVGRectElement, unknown, HTMLElement, any> | null = null;

  constructor(options: SelectionManagerOptions) {
    this.svg = options.svg;
    this.zoomGroup = options.zoomGroup;
    this.nodesLayer = options.nodesLayer;
    this.tagNodesLayer = options.tagNodesLayer;
    this.onNodeSelected = options.onNodeSelected;
    this.onTagSelected = options.onTagSelected;
    this.onHidePopover = options.onHidePopover;
    this.getTree = options.getTree;
    this.getCustomModels = options.getCustomModels;
    this.getIsSpacePressed = options.getIsSpacePressed;
    this.onRenderGraph = options.onRenderGraph;

    this.initCanvasEvents();
  }

  public getIsMarqueeSelecting(): boolean {
    return this.isMarqueeSelecting;
  }

  public getJustFinishedMarquee(): boolean {
    return this.justFinishedMarquee;
  }

  public getSelectedNode(): BtNode | null {
    return this.selectedNode;
  }

  public getSelectedNodes(): BtNode[] {
    return Array.from(this.selectedNodes);
  }

  public getSelectedTag(): TagNode | null {
    if (this.selectedTags.size === 0) {
      return null;
    }
    return Array.from(this.selectedTags)[0];
  }

  public getSelectedTags(): TagNode[] {
    return Array.from(this.selectedTags);
  }

  public setSelectedNode(node: BtNode | null) {
    this.selectedNode = node;
    this.selectedNodes.clear();
    if (node) {
      this.selectedNodes.add(node);
    }
    this.updateVisualSelection();
  }

  public setSelectedTag(tag: TagNode | null) {
    this.selectedTags.clear();
    if (tag) {
      this.selectedTags.add(tag);
      this.selectedNode = null;
      this.selectedNodes.clear();
    }
    this.updateVisualSelection();
    this.onTagSelected?.(tag);
  }

  public toggleTagSelection(tag: TagNode, multiSelect = false) {
    if (!multiSelect) {
      this.selectedTags.clear();
      this.selectedTags.add(tag);
      this.selectedNode = null;
      this.selectedNodes.clear();
    } else {
      if (this.selectedTags.has(tag)) {
        this.selectedTags.delete(tag);
      } else {
        this.selectedTags.add(tag);
      }
    }
    this.updateVisualSelection();
    this.onTagSelected?.(this.getSelectedTag());
  }

  public clearSelection() {
    this.selectedNode = null;
    this.selectedNodes.clear();
    this.selectedTags.clear();
    this.updateVisualSelection();
    this.onNodeSelected(null);
    this.onTagSelected?.(null);
  }

  public updateVisualSelection() {
    this.nodesLayer.selectAll<SVGGElement, BtNode>('.blender-node')
      .classed('selected', (d: any) => this.selectedNodes.has(d));

    this.tagNodesLayer.selectAll<SVGGElement, TagNode>('g.tag-node')
      .classed('selected', (d: any) => this.selectedTags.has(d));
  }

  public deleteSelectedTag(): boolean {
    return this.deleteSelectedTags();
  }

  public deleteSelectedTags(): boolean {
    const tree = this.getTree();
    if (!tree?.tagNodes || this.selectedTags.size === 0) {
      return false;
    }

    const tagsToDelete = Array.from(this.selectedTags);
    let removedCount = 0;
    tagsToDelete.forEach(tag => {
      const idx = tree.tagNodes!.indexOf(tag);
      if (idx !== -1) {
        tree.tagNodes!.splice(idx, 1);
        removedCount++;
      }
    });

    if (removedCount > 0) {
      this.selectedTags.clear();
      this.onRenderGraph(false);
      return true;
    }
    return false;
  }

  private initCanvasEvents() {
    // 1. Mousedown on background -> Start Marquee Selection Box
    this.svg.on('mousedown', (event: MouseEvent) => {
      if (event.button !== 0 || this.getIsSpacePressed()) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest('.blender-node, .tag-node, .socket-pin, .grid-btn, button, input, select')) {
        return;
      }

      this.onHidePopover();
      const svgNode = this.svg.node();
      const zoomNode = this.zoomGroup.node();
      if (!svgNode || !zoomNode) {
        return;
      }

      const [sx, sy] = d3.pointer(event, svgNode);
      const [mx, my] = d3.pointer(event, zoomNode);

      this.isMarqueeSelecting = true;
      this.marqueeStartScreen = { x: sx, y: sy };
      this.marqueeStartCanvas = { x: mx, y: my };

      if (!event.shiftKey) {
        this.selectedNodes.clear();
        this.selectedTags.clear();
        this.selectedNode = null;
        this.onNodeSelected(null);
        this.onTagSelected?.(null);
        this.updateVisualSelection();
      }

      if (this.marqueeRect) {
        this.marqueeRect.remove();
      }

      // IMPORTANT: Append marquee rect directly to root svg (outside zoomGroup)
      // This guarantees that stroke-dasharray and stroke-width are NEVER affected by zoom!
      this.marqueeRect = this.svg.append('rect')
        .attr('id', 'marquee-selection-box')
        .attr('class', 'fill-primary/10 stroke-primary stroke-[1.5px] [stroke-dasharray:6_4] pointer-events-none')
        .attr('x', sx)
        .attr('y', sy)
        .attr('width', 0)
        .attr('height', 0);
    });

    // 2. Window Mousemove for Marquee Selection
    window.addEventListener('mousemove', (event: MouseEvent) => {
      if (!this.isMarqueeSelecting || !this.marqueeStartScreen || !this.marqueeStartCanvas || !this.marqueeRect) {
        return;
      }

      const svgNode = this.svg.node();
      const zoomNode = this.zoomGroup.node();
      if (!svgNode || !zoomNode) {
        return;
      }

      // Screen coordinates for rendering crisp, zoom-independent marquee rect
      const [currSx, currSy] = d3.pointer(event, svgNode);
      const sx = Math.min(this.marqueeStartScreen.x, currSx);
      const sy = Math.min(this.marqueeStartScreen.y, currSy);
      const sw = Math.abs(currSx - this.marqueeStartScreen.x);
      const sh = Math.abs(currSy - this.marqueeStartScreen.y);

      this.marqueeRect
        .attr('x', sx)
        .attr('y', sy)
        .attr('width', sw)
        .attr('height', sh);

      // Canvas coordinates for intersection hit testing
      const [currCx, currCy] = d3.pointer(event, zoomNode);
      const cx = Math.min(this.marqueeStartCanvas.x, currCx);
      const cy = Math.min(this.marqueeStartCanvas.y, currCy);
      const cw = Math.abs(currCx - this.marqueeStartCanvas.x);
      const ch = Math.abs(currCy - this.marqueeStartCanvas.y);

      const tree = this.getTree();
      const customModels = this.getCustomModels();

      // Hit-test standard / composite / decorator tree nodes
      const allNodes = tree ? CanvasLayoutService.getAllTreeNodes(tree) : [];
      allNodes.forEach(cand => {
        const nw = CanvasLayoutService.getNodeWidth(cand);
        const nh = CanvasLayoutService.getNodeHeight(cand, customModels);
        const nodeX = cand.x ?? 0;
        const nodeY = cand.y ?? 0;
        const isOverlap = !(nodeX + nw / 2 < cx || nodeX - nw / 2 > cx + cw || nodeY + nh / 2 < cy || nodeY - nh / 2 > cy + ch);
        if (isOverlap) {
          this.selectedNodes.add(cand);
        } else if (!event.shiftKey) {
          this.selectedNodes.delete(cand);
        }
      });

      // Hit-test blackboard tag nodes (width = 135, height = 48)
      const tagNodes = tree?.tagNodes || [];
      const tagW = 135;
      const tagH = 48;
      tagNodes.forEach(tag => {
        const tagX = tag.x ?? 0;
        const tagY = tag.y ?? 0;
        const isTagOverlap = !(tagX + tagW / 2 < cx || tagX - tagW / 2 > cx + cw || tagY + tagH / 2 < cy || tagY - tagH / 2 > cy + ch);
        if (isTagOverlap) {
          this.selectedTags.add(tag);
        } else if (!event.shiftKey) {
          this.selectedTags.delete(tag);
        }
      });

      this.updateVisualSelection();
    });

    // 3. Window Mouseup for Finishing Marquee
    window.addEventListener('mouseup', () => {
      if (this.isMarqueeSelecting) {
        this.isMarqueeSelecting = false;
        this.marqueeStartScreen = null;
        this.marqueeStartCanvas = null;

        if (this.marqueeRect) {
          this.marqueeRect.remove();
          this.marqueeRect = null;
        }

        if (this.selectedNodes.size > 0) {
          const first = Array.from(this.selectedNodes)[0];
          this.selectedNode = first;
          this.onNodeSelected(first);
        } else {
          this.selectedNode = null;
        }

        if (this.selectedTags.size > 0) {
          const firstTag = Array.from(this.selectedTags)[0];
          this.onTagSelected?.(firstTag);
        }

        // Set guard so immediate SVG click does not clear selection
        this.justFinishedMarquee = true;
        setTimeout(() => {
          this.justFinishedMarquee = false;
        }, 200);
      }
    });

    // 4. Click blank SVG to clear selection
    this.svg.on('click', (event) => {
      this.onHidePopover();
      if (this.justFinishedMarquee) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.id === 'tree-svg' || target.id === 'viewport-group' || target.id === 'blueprint-grid') {
        this.clearSelection();
      }
    });
  }
}
