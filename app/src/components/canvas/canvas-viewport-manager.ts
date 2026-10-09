import * as d3 from 'd3';
import { BehaviorTree, NodeModel } from '../../types';
import { CanvasLayoutService } from './canvas-layout';
import { GridMode } from './canvas-types';

export interface ViewportManagerOptions {
  svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  zoomGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  onZoomChange?: (zoomPercent: number) => void;
  isInteractingPredicate?: () => boolean;
}

export class CanvasViewportManager {
  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private zoomGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private zoomBehavior!: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private isSpacePressed = false;
  private onZoomChange?: (zoomPercent: number) => void;
  private isInteractingPredicate?: () => boolean;

  constructor(options: ViewportManagerOptions) {
    this.svg = options.svg;
    this.zoomGroup = options.zoomGroup;
    this.onZoomChange = options.onZoomChange;
    this.isInteractingPredicate = options.isInteractingPredicate;

    this.initKeyboardTracking();
    this.initZoomBehavior();
    this.initGridControls();
  }

  public getIsSpacePressed(): boolean {
    return this.isSpacePressed;
  }

  public getZoomBehavior(): d3.ZoomBehavior<SVGSVGElement, unknown> {
    return this.zoomBehavior;
  }

  private initKeyboardTracking() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && (document.activeElement as HTMLElement)?.tagName !== 'INPUT' && (document.activeElement as HTMLElement)?.tagName !== 'TEXTAREA') {
        this.isSpacePressed = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
      }
    });
  }

  private initZoomBehavior() {
    const container = document.getElementById('canvas-container') as HTMLElement | null;
    const height = container?.clientHeight || 600;

    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3.5])
      .filter((event: MouseEvent) => {
        if (this.isInteractingPredicate && this.isInteractingPredicate()) {
          return false;
        }
        // Pan on Space + left click or middle click
        if (event.type === 'mousedown') {
          return event.button === 1 || (event.button === 0 && this.isSpacePressed);
        }
        // Wheel zoom
        return event.type === 'wheel';
      })
      .on('zoom', (event) => {
        this.zoomGroup.attr('transform', event.transform);
        this.onZoomChange?.(Math.round(event.transform.k * 100));
      });

    this.svg.call(this.zoomBehavior as any);
    this.svg.call(this.zoomBehavior.transform as any, d3.zoomIdentity.translate(80, height / 2 - 40).scale(0.92));
    this.onZoomChange?.(92);
  }

  public setGridMode(mode: GridMode) {
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
        const mode = btn.dataset.grid as GridMode;
        if (mode) {
          this.setGridMode(mode);
        }
      });
    });
  }

  public setZoom(percent: number) {
    const k = percent / 100;
    const current = d3.zoomTransform(this.svg.node() as any);
    this.svg.transition().duration(200).call(
      this.zoomBehavior.transform as any,
      d3.zoomIdentity.translate(current.x, current.y).scale(k)
    );
  }

  public zoomIn() {
    this.svg.transition().duration(200).call(this.zoomBehavior.scaleBy as any, 1.25);
  }

  public zoomOut() {
    this.svg.transition().duration(200).call(this.zoomBehavior.scaleBy as any, 0.8);
  }

  public resetZoom() {
    const current = d3.zoomTransform(this.svg.node() as any);
    this.svg.transition().duration(250).call(
      this.zoomBehavior.transform as any,
      d3.zoomIdentity.translate(current.x, current.y).scale(1.0)
    );
  }

  public resetView(tree: BehaviorTree | null, customModels: NodeModel[]) {
    const container = document.getElementById('canvas-container') as HTMLElement | null;
    const height = container?.clientHeight || 600;

    if (!tree || !tree.root) {
      this.svg.transition().duration(400).call(
        this.zoomBehavior.transform as any,
        d3.zoomIdentity.translate(80, height / 2 - 40).scale(0.92)
      );
      return;
    }

    const allNodes = CanvasLayoutService.getAllTreeNodes(tree);
    if (allNodes.length === 0) {
      return;
    }

    let minY = Infinity, maxY = -Infinity;
    allNodes.forEach(n => {
      const nh = CanvasLayoutService.getNodeHeight(n, customModels);
      const y = n.y ?? 0;
      minY = Math.min(minY, y - nh / 2);
      maxY = Math.max(maxY, y + nh / 2);
    });

    const rootY = tree.root.y ?? 0;
    const targetY = height / 2 - rootY;

    this.svg.transition().duration(400).call(
      this.zoomBehavior.transform as any,
      d3.zoomIdentity.translate(80, targetY).scale(0.92)
    );
  }

  public screenToCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
    const zoomNode = this.zoomGroup?.node();
    const svgNode = this.svg?.node();
    if (!zoomNode || !svgNode) {
      return { x: clientX, y: clientY };
    }

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
}
