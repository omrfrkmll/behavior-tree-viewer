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

  public getWidth(node: BtNode): number {
    const spineW = CANVAS_CONSTANTS.SPINE_WIDTH;
    const padLeft = CANVAS_CONSTANTS.SEQUENCE_PAD_LEFT;
    const padRight = CANVAS_CONSTANTS.SEQUENCE_PAD_RIGHT;
    let maxChildW = CANVAS_CONSTANTS.NODE_WIDTH;

    if (node.children && node.children.length > 0) {
      for (const c of node.children) {
        if (c.name.toLowerCase().includes('sequence')) {
          maxChildW = Math.max(maxChildW, this.getWidth(c));
        }
      }
    }
    return spineW + padLeft + maxChildW + padRight;
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
    const emptyCavityH = childCount === 0 ? 44 : 0;
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
    return [];
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
    const padLeft = CANVAS_CONSTANTS.SEQUENCE_PAD_LEFT;
    const padRight = CANVAS_CONSTANTS.SEQUENCE_PAD_RIGHT;

    // 1. Stand-alone Top Header Card
    g.append('rect')
      .attr('class', 'node-card fill-[var(--node-bg)] stroke-[var(--node-border)] stroke-[1.5px] [filter:drop-shadow(0_6px_14px_rgba(0,0,0,0.16))] transition-[stroke,fill,filter] duration-150')
      .attr('x', -width / 2)
      .attr('y', -height / 2)
      .attr('width', width)
      .attr('height', headerHeight)
      .attr('rx', 8)
      .attr('ry', 8);

    // Subtle cavity container panel enclosing the sequence's execution body
    const cavityX = -width / 2 + spineWidth - 4;
    const cavityY = -height / 2 + headerHeight + 6;
    const cavityW = width - spineWidth - 4;
    const cavityH = height - headerHeight - footerHeight - 12;

    g.append('rect')
      .attr('class', 'sequence-cavity-bg fill-secondary/15 stroke-border/40 stroke-[1px] [stroke-dasharray:4_4] pointer-events-none')
      .attr('x', cavityX)
      .attr('y', cavityY)
      .attr('width', cavityW)
      .attr('height', cavityH)
      .attr('rx', 8);

    // Category Accent Stripe on left of Sequence Header Card
    BadgesHelper.renderCategoryStripe(
      g,
      -width / 2 + 2.5,
      -height / 2 + 7,
      headerHeight - 14,
      node.category || 'Control'
    );

    // 2. Header Content
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
    BadgesHelper.renderCategoryBadge(g, catBadgeX, catBadgeY, node.category || 'Control', catBadgeW, catBadgeH);

    // Step Count Badge
    const stepBadgeW = 46;
    const stepBadgeH = 15;
    const stepBadgeX = catBadgeX - stepBadgeW - 4;
    const stepText = `${childCount} step${childCount !== 1 ? 's' : ''}`;
    BadgesHelper.renderOrderBadge(g, stepBadgeX, catBadgeY, stepText, stepBadgeW, stepBadgeH);

    // Flow Sockets on Header Card: only in-socket if not inside a parent sequence; no out-socket
    const headerCenterY = -height / 2 + 18;
    const isSequenceChild = Boolean(node.parent?.name.toLowerCase().includes('sequence'));
    if (!isSequenceChild) {
      SocketsHelper.renderInSocket(g, -width / 2, headerCenterY, node, callbacks);
    }

    // 3. Side-Nav Vertical Rail & Branching Arrows into each Child Node
    const spineCenterX = -width / 2 + spineWidth / 2;
    const spineStartY = -height / 2 + headerHeight;
    const childLeftX = -width / 2 + spineWidth + padLeft;

    const addBtnW = width - spineWidth - padLeft - padRight;
    const addBtnH = CANVAS_CONSTANTS.SEQUENCE_ADD_BTN_H;
    const addBtnX = childLeftX;
    const addBtnY = height / 2 - footerHeight - 10 - addBtnH;

    if (childCount > 0 && node.children) {
      const lastChild = node.children[node.children.length - 1];
      const lastTargetSocket = CanvasLayoutService.getSocketCoords(lastChild, 'in', customModels);
      const spineEndY = lastTargetSocket.y - (node.y ?? 0);

      const lowerName = node.name.toLowerCase();
      const isReactive = lowerName.includes('reactive');
      const isPipeline = lowerName.includes('pipeline');

      // Behavior Tree Sequence execution semantics timing:
      // - Standard Sequence: tick arrives at header, evaluates Child 1 -> Child 1 succeeds (green glow) ->
      //   pulse flows down spine to Child 2 -> evaluates Child 2 -> succeeds -> etc.
      // - ReactiveSequence: continuous top-down precondition sweep (rapid evaluation)
      // - PipelineSequence: simultaneous pipeline stream across all stages
      const stepDuration = isPipeline ? 1.6 : (isReactive ? 0.45 : 1.0);
      const pauseAfter = isPipeline ? 0 : 0.6;
      const animDuration = isPipeline
        ? 1.6
        : (isReactive
          ? Math.max(1.8, childCount * stepDuration + 0.4)
          : Math.max(2.4, childCount * stepDuration + pauseAfter));

      // Clean continuous solid vertical spine rail running downwards like a side navigation
      g.append('line')
        .attr('class', 'stroke-primary/35 stroke-[2px]')
        .attr('x1', spineCenterX)
        .attr('y1', spineStartY)
        .attr('x2', spineCenterX)
        .attr('y2', spineEndY);


      // 3. Curved branch arrows entering each child node's left card border
      node.children.forEach((child, idx) => {
        const targetSocket = CanvasLayoutService.getSocketCoords(child, 'in', customModels);
        const socketRelX = targetSocket.x - (node.x ?? 0);
        const socketRelY = targetSocket.y - (node.y ?? 0);

        const branchG = g.append('g').attr('class', 'sequence-branch');

        const cornerR = 8;
        // Arrow tip meets the node card left border directly
        const arrowTipX = socketRelX;
        const arrowBaseX = socketRelX - 6;

        const branchPath = [
          `M ${spineCenterX} ${socketRelY - cornerR}`,
          `Q ${spineCenterX} ${socketRelY} ${spineCenterX + cornerR} ${socketRelY}`,
          `L ${arrowBaseX} ${socketRelY}`
        ].join(' ');

        const animDelay = isPipeline ? 0 : idx * stepDuration;

        // Curved branching path base
        branchG.append('path')
          .attr('d', branchPath)
          .attr('fill', 'none')
          .attr('class', 'stroke-primary/30 stroke-[2px] stroke-round');

        // Animated evaluation flow hint overlay (pulses on tick arrival, glows success, then advances)
        branchG.append('path')
          .attr('d', branchPath)
          .attr('fill', 'none')
          .attr('class', 'stroke-primary stroke-[2.5px] stroke-round pointer-events-none')
          .style('stroke-dasharray', '24 48')
          .style('animation', `sequence-branch-eval ${animDuration}s cubic-bezier(0.4, 0, 0.2, 1) infinite`)
          .style('animation-delay', `${animDelay}s`)
          .style('opacity', '0.2');

        // Directional arrowhead with dynamic evaluation glow
        branchG.append('path')
          .attr('d', `M ${arrowBaseX} ${socketRelY - 3.5} L ${arrowTipX} ${socketRelY} L ${arrowBaseX} ${socketRelY + 3.5} Z`)
          .attr('class', 'fill-primary stroke-primary stroke-[0.5px]')
          .style('animation', `sequence-arrow-eval ${animDuration}s ease-in-out infinite`)
          .style('animation-delay', `${animDelay}s`);

        // Step number indicator pill on the branch
        const midX = (spineCenterX + cornerR + arrowBaseX) / 2;
        branchG.append('circle')
          .attr('cx', midX)
          .attr('cy', socketRelY)
          .attr('r', 5.5)
          .attr('class', 'fill-[var(--node-bg)]')
          .style('animation', `sequence-step-badge ${animDuration}s ease-in-out infinite`)
          .style('animation-delay', `${animDelay}s`);

        branchG.append('text')
          .attr('class', 'fill-foreground font-mono text-[7px] font-bold select-none pointer-events-none')
          .attr('x', midX)
          .attr('y', socketRelY + 2.5)
          .attr('text-anchor', 'middle')
          .text(`${idx + 1}`);
      });

      // Subtle dashed connector from last child to Add Node button
      const addBtnCenterY = addBtnY + addBtnH / 2;
      g.append('path')
        .attr('d', `M ${spineCenterX} ${spineEndY} V ${addBtnCenterY - 6} Q ${spineCenterX} ${addBtnCenterY} ${spineCenterX + 6} ${addBtnCenterY} H ${addBtnX - 4}`)
        .attr('fill', 'none')
        .attr('class', 'stroke-border stroke-[1.25px] [stroke-dasharray:3_3]');
    } else {
      // Empty Sequence placeholder
      const emptyBoxX = childLeftX;
      const emptyBoxY = -height / 2 + headerHeight + 12;
      const emptyBoxW = addBtnW;
      const emptyBoxH = 34;

      g.append('rect')
        .attr('class', 'fill-secondary/20 stroke-border stroke-[1px] [stroke-dasharray:4_4]')
        .attr('x', emptyBoxX)
        .attr('y', emptyBoxY)
        .attr('width', emptyBoxW)
        .attr('height', emptyBoxH)
        .attr('rx', 6);

      g.append('text')
        .attr('class', 'fill-muted-foreground text-[10.5px] font-sans select-none pointer-events-none')
        .attr('x', emptyBoxX + emptyBoxW / 2)
        .attr('y', emptyBoxY + emptyBoxH / 2 + 4)
        .attr('text-anchor', 'middle')
        .text('Empty Sequence');

      const emptyCenterY = emptyBoxY + emptyBoxH / 2;
      g.append('path')
        .attr('d', `M ${spineCenterX} ${spineStartY} V ${emptyCenterY - 6} Q ${spineCenterX} ${emptyCenterY} ${spineCenterX + 6} ${emptyCenterY} H ${emptyBoxX - 4}`)
        .attr('fill', 'none')
        .attr('class', 'stroke-primary/40 stroke-[1.5px] [stroke-dasharray:4_4]');
    }

    // 4. "+ Add Node" Button
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
  }
}
