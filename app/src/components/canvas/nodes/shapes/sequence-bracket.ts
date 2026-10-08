import * as d3 from 'd3';
import { BtNode, NodeModel } from '../../../../types';
import { CANVAS_CONSTANTS, CanvasLayoutService } from '../../canvas-layout';
import { QuickAddPopover } from '../../quick-add-popover';
import { BadgesHelper } from '../common/badges';
import { SocketsHelper } from '../common/sockets';
import { NodeRendererCallbacks, NodeShapeRenderer, SocketType } from '../types';

export class SequenceBracketShape implements NodeShapeRenderer {
  public readonly name = 'sequence-bracket';
  public readonly isContainer = true;

  public getWidth(_node: BtNode): number {
    return CANVAS_CONSTANTS.SEQUENCE_WIDTH;
  }

  public getHeight(node: BtNode, customModels: NodeModel[]): number {
    const childCount = node.children ? node.children.length : 0;
    let totalChildH = 0;
    if (childCount > 0) {
      node.children.forEach((c, idx) => {
        const ch = CanvasLayoutService.getNodeHeight(c, customModels);
        totalChildH += ch + (idx > 0 ? CANVAS_CONSTANTS.SEQUENCE_CHILD_GAP : 0);
      });
    }
    const emptyCavityH = childCount === 0 ? 38 : 0;
    const gapBeforeAddBtn = childCount > 0 ? 10 : 0;
    return CANVAS_CONSTANTS.SEQUENCE_HEADER_H +
      CANVAS_CONSTANTS.SEQUENCE_PAD_TOP +
      totalChildH +
      emptyCavityH +
      gapBeforeAddBtn +
      CANVAS_CONSTANTS.SEQUENCE_ADD_BTN_H +
      CANVAS_CONSTANTS.SEQUENCE_PAD_BOT +
      CANVAS_CONSTANTS.SEQUENCE_FOOTER_H;
  }

  public getOutputSockets(_node: BtNode): SocketType[] {
    return ['out'];
  }

  public getSocketCoords(
    node: BtNode,
    portType: SocketType,
    customModels: NodeModel[]
  ): { x: number; y: number } {
    const nx = node.x ?? 0;
    const ny = node.y ?? 0;
    const halfW = this.getWidth(node) / 2;
    const h = this.getHeight(node, customModels);
    const headerCenterY = ny - h / 2 + 18;

    if (portType === 'in') {
      return { x: nx - halfW, y: headerCenterY };
    }
    return { x: nx + halfW, y: headerCenterY };
  }

  public render(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    node: BtNode,
    width: number,
    height: number,
    customModels: NodeModel[],
    callbacks: NodeRendererCallbacks
  ): void {
    const childCount = node.children ? node.children.length : 0;
    const headerHeight = CANVAS_CONSTANTS.SEQUENCE_HEADER_H;
    const footerHeight = CANVAS_CONSTANTS.SEQUENCE_FOOTER_H;
    const spineWidth = CANVAS_CONSTANTS.SPINE_WIDTH;

    // 1. Single Unified C-Bracket Vector Path
    const cPath = CanvasLayoutService.getCBracketPath(width, height, spineWidth, headerHeight, footerHeight, 8);
    g.append('path')
      .attr('class', 'node-card fill-[var(--node-bg)] stroke-[var(--node-border)] stroke-[1.5px] [filter:drop-shadow(0_6px_14px_rgba(0,0,0,0.16))] transition-[stroke,fill,filter] duration-150')
      .attr('d', cPath);

    // Category Accent Stripe on left of Sequence header
    BadgesHelper.renderCategoryStripe(
      g,
      -width / 2 + 2.5,
      -height / 2 + 7,
      headerHeight - 14,
      node.category
    );

    // 2. Spine Directional Flow Guideline
    const spineCenterX = -width / 2 + spineWidth / 2;
    const spineStartY = -height / 2 + headerHeight + 8;
    const spineEndY = height / 2 - footerHeight - 8;

    if (spineEndY > spineStartY + 10) {
      g.append('line')
        .attr('class', 'stroke-primary/45 stroke-[1.5px] [stroke-dasharray:5_5]')
        .attr('x1', spineCenterX)
        .attr('y1', spineStartY)
        .attr('x2', spineCenterX)
        .attr('y2', spineEndY);

      // Downward arrow at bottom of spine
      g.append('path')
        .attr('d', `M ${spineCenterX - 4} ${spineEndY - 5} L ${spineCenterX} ${spineEndY} L ${spineCenterX + 4} ${spineEndY - 5}`)
        .attr('fill', 'none')
        .attr('class', 'stroke-primary/60 stroke-[1.5px] stroke-round');
    }

    // 3. Header Content
    g.append('text')
      .attr('class', 'fill-foreground font-mono font-bold text-[11px] select-none pointer-events-none')
      .attr('x', -width / 2 + 12)
      .attr('y', -height / 2 + 22)
      .text('➔');

    g.append('text')
      .attr('class', 'fill-foreground font-sans font-semibold text-[11.5px] select-none pointer-events-none')
      .attr('x', -width / 2 + 28)
      .attr('y', -height / 2 + 22)
      .text(node.name);

    if (node.customName && node.customName !== node.name) {
      g.append('text')
        .attr('class', 'fill-muted-foreground font-mono text-[9.5px] select-none pointer-events-none')
        .attr('x', -width / 2 + 95)
        .attr('y', -height / 2 + 22)
        .text(`(${node.customName})`);
    }

    // Right: Category Badge & Step Count Badge
    const catBadgeW = 54;
    const catBadgeH = 15;
    const catBadgeX = width / 2 - catBadgeW - 8;
    const catBadgeY = -height / 2 + 10;
    BadgesHelper.renderCategoryBadge(g, catBadgeX, catBadgeY, node.category, catBadgeW, catBadgeH);

    // Step Count Badge
    const stepBadgeW = 46;
    const stepBadgeH = 15;
    const stepBadgeX = catBadgeX - stepBadgeW - 4;
    const stepText = `${childCount} step${childCount !== 1 ? 's' : ''}`;
    BadgesHelper.renderOrderBadge(g, stepBadgeX, catBadgeY, stepText, stepBadgeW, stepBadgeH);

    // Flow Sockets on Header
    const headerCenterY = -height / 2 + 18;
    SocketsHelper.renderInSocket(g, -width / 2, headerCenterY, node, callbacks);
    SocketsHelper.renderOutSocket(g, width / 2, headerCenterY, node, 'out', callbacks, '#3b82f6');

    // Empty Sequence placeholder
    if (childCount === 0) {
      g.append('text')
        .attr('class', 'fill-muted-foreground text-[10.5px] font-sans select-none pointer-events-none')
        .attr('x', (-width / 2 + spineWidth + width / 2) / 2)
        .attr('y', -height / 2 + headerHeight + 22)
        .attr('text-anchor', 'middle')
        .text('Empty Sequence');
    }

    // 4. "+ Add Node" Button at bottom of cavity
    const addBtnW = CANVAS_CONSTANTS.NODE_WIDTH;
    const addBtnH = CANVAS_CONSTANTS.SEQUENCE_ADD_BTN_H;
    const addBtnX = -width / 2 + spineWidth + 14;
    const addBtnY = height / 2 - footerHeight - 10 - addBtnH;

    const addBtnG = g.append('g')
      .attr('class', 'cursor-pointer group/addbtn')
      .attr('transform', `translate(${addBtnX}, ${addBtnY})`)
      .on('mousedown', (event) => {
        event.stopPropagation();
      })
      .on('click', function (event) {
        event.stopPropagation();
        const rect = (this as SVGGElement).getBoundingClientRect();
        QuickAddPopover.show(node, rect, customModels, (newNode) => {
          callbacks.onNodeAddedToSequence(node, newNode);
        });
      });

    addBtnG.append('rect')
      .attr('class', 'fill-secondary/35 stroke-border stroke-[1px] [stroke-dasharray:5_4] group-hover/addbtn:fill-secondary group-hover/addbtn:stroke-primary transition-colors duration-150 rx-1')
      .attr('width', addBtnW)
      .attr('height', addBtnH)
      .attr('rx', 5);

    addBtnG.append('text')
      .attr('class', 'fill-muted-foreground font-sans text-[11px] font-medium group-hover/addbtn:fill-primary transition-colors select-none pointer-events-none')
      .attr('x', addBtnW / 2)
      .attr('y', 15.5)
      .attr('text-anchor', 'middle')
      .text('+ Add Node');

    // 5. Footer Shelf hint
    g.append('text')
      .attr('class', 'fill-muted-foreground/75 font-sans font-medium text-[8.5px] tracking-wider uppercase select-none pointer-events-none')
      .attr('x', -width / 2 + 12)
      .attr('y', height / 2 - 7)
      .text('── Sequence Execution ──');
  }
}
