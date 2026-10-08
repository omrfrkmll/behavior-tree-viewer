import * as d3 from 'd3';
import { BtNode, NodeModel } from '../../../../types';
import { CANVAS_CONSTANTS } from '../../canvas-layout';
import { BadgesHelper } from '../common/badges';
import { PortsHelper } from '../common/ports';
import { SocketsHelper } from '../common/sockets';
import { NodeRendererCallbacks, NodeShapeRenderer, SocketType } from '../types';

export class DecoratorCardShape implements NodeShapeRenderer {
  public readonly name = 'decorator-card';
  public readonly isContainer = false;

  public getWidth(_node: BtNode): number {
    return CANVAS_CONSTANTS.NODE_WIDTH;
  }

  public getHeight(node: BtNode, customModels: NodeModel[]): number {
    const model = customModels.find(m => m.name === node.name);
    const ports = model?.ports || [];
    const portCount = ports.length || Object.keys(node.attributes).length || 0;
    const customNameExtra = (node.customName && node.customName !== node.name) ? 12 : 0;
    if (portCount === 0) {
      return 46 + customNameExtra;
    }
    return CANVAS_CONSTANTS.HEADER_HEIGHT + 14 + (portCount * CANVAS_CONSTANTS.ROW_HEIGHT) + customNameExtra;
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
    const headerCenterY = ny - h / 2 + 16;

    if (portType === 'in') {
      return { x: nx - halfW, y: headerCenterY };
    }
    return { x: nx + halfW, y: headerCenterY };
  }

  public getParameterSocketCoords(
    node: BtNode,
    portName: string,
    customModels: NodeModel[]
  ): { x: number; y: number } {
    const nx = node.x ?? 0;
    const ny = node.y ?? 0;
    const halfW = this.getWidth(node) / 2;
    const h = this.getHeight(node, customModels);
    const model = customModels.find(m => m.name === node.name);
    const ports = model?.ports || [];
    const idx = ports.findIndex(p => p.name === portName);
    const portDef = idx !== -1 ? ports[idx] : null;
    const isInput = !portDef || portDef.direction === 'input';

    const customNameExtra = (node.customName && node.customName !== node.name) ? 12 : 0;
    const dividerY = -h / 2 + CANVAS_CONSTANTS.HEADER_HEIGHT + customNameExtra;
    const portYStart = dividerY + 14;
    const rowY = portYStart + (idx >= 0 ? idx : 0) * CANVAS_CONSTANTS.ROW_HEIGHT;

    return {
      x: isInput ? nx - halfW : nx + halfW,
      y: ny + rowY
    };
  }

  public render(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    node: BtNode,
    width: number,
    height: number,
    customModels: NodeModel[],
    callbacks: NodeRendererCallbacks
  ): void {
    const model = customModels.find(m => m.name === node.name);
    const ports = model?.ports || [];
    const hasPorts = ports.length > 0;
    const customNameExtra = (node.customName && node.customName !== node.name) ? 12 : 0;
    const isSequenceChild = node.parent?.name === 'Sequence';
    const seq = isSequenceChild ? node.parent! : null;
    const childIdx = seq ? seq.children.indexOf(node) : -1;

    // 1. Decorator Card Container with a distinct border style (dashed accent indicator)
    g.append('rect')
      .attr('class', 'node-card fill-[var(--node-bg)] stroke-[var(--node-border)] stroke-[1.5px] [filter:drop-shadow(0_6px_14px_rgba(0,0,0,0.16))] transition-[stroke,fill,filter] duration-150')
      .attr('width', width)
      .attr('height', height)
      .attr('x', -width / 2)
      .attr('y', -height / 2)
      .attr('rx', 10)
      .attr('ry', 10);

    const headerH = hasPorts ? CANVAS_CONSTANTS.HEADER_HEIGHT + customNameExtra : height;
    if (hasPorts) {
      g.append('path')
        .attr('class', 'fill-[var(--node-header-bg)]')
        .attr('d', `M ${-width / 2 + 1.5} ${-height / 2 + 8} A 6.5 6.5 0 0 1 ${-width / 2 + 8} ${-height / 2 + 1.5} L ${width / 2 - 8} ${-height / 2 + 1.5} A 6.5 6.5 0 0 1 ${width / 2 - 1.5} ${-height / 2 + 8} L ${width / 2 - 1.5} ${-height / 2 + headerH} L ${-width / 2 + 1.5} ${-height / 2 + headerH} Z`);
    }

    // Category Accent Stripe on left border
    BadgesHelper.renderCategoryStripe(
      g,
      -width / 2 + 2.5,
      -height / 2 + 7,
      (hasPorts ? headerH : height) - 14,
      node.category
    );

    // 2. Header Row Elements
    BadgesHelper.renderSymbol(g, -width / 2 + 13, -height / 2 + 19, node.name, node.category);

    let rightOffset = 8;
    if (isSequenceChild && seq) {
      BadgesHelper.renderDetachButton(
        g,
        width / 2 - 25,
        -height / 2 + 8,
        () => callbacks.onDetachSequenceChild(seq, node, childIdx)
      );
      rightOffset = 30;
    }

    const titleMaxLen = isSequenceChild ? 13 : 15;
    BadgesHelper.renderNodeHeaderTitle(
      g,
      -width / 2 + 27,
      -height / 2 + 19,
      node.name,
      node.customName,
      titleMaxLen
    );

    // Right: Category Badge Pill
    const catBadgeW = 54;
    const catBadgeH = 15;
    const catBadgeX = width / 2 - catBadgeW - rightOffset;
    const catBadgeY = -height / 2 + 8;
    BadgesHelper.renderCategoryBadge(g, catBadgeX, catBadgeY, node.category, catBadgeW, catBadgeH);

    // Order Badge Pill (ROOT or #1, #2)
    const orderBadgeW = 28;
    const orderBadgeH = 15;
    const orderBadgeX = catBadgeX - orderBadgeW - 4;
    const orderText = !node.parent ? 'ROOT' : `#${(childIdx >= 0 ? childIdx + 1 : 1)}`;
    BadgesHelper.renderOrderBadge(g, orderBadgeX, catBadgeY, orderText, orderBadgeW, orderBadgeH);

    // 3. Hairline Divider & Parameter Ports
    if (hasPorts) {
      const dividerY = -height / 2 + CANVAS_CONSTANTS.HEADER_HEIGHT + customNameExtra;
      g.append('line')
        .attr('class', 'stroke-border stroke-[0.75px] [stroke-dasharray:4_4]')
        .attr('x1', -width / 2 + 8)
        .attr('y1', dividerY)
        .attr('x2', width / 2 - 8)
        .attr('y2', dividerY);

      PortsHelper.renderParameterPorts(
        g,
        node,
        width,
        dividerY + 14,
        customModels,
        callbacks
      );
    }

    // 4. Execution Flow Sockets
    const headerCenterY = -height / 2 + 16;
    if (!isSequenceChild) {
      SocketsHelper.renderInSocket(g, -width / 2, headerCenterY, node, callbacks);
    }
    SocketsHelper.renderOutSocket(g, width / 2, headerCenterY, node, 'out', callbacks, '#8b5cf6');
  }
}
