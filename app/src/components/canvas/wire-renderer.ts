import * as d3 from 'd3';
import { BtNode, NodeModel, NodeStatus, TagNode } from '../../types';
import { computeBezierWire } from '../../utils/math';
import { CanvasLayoutService } from './canvas-layout';
import { NodeShapeRegistry } from './nodes/registry';

export interface WireRendererCallbacks {
  onDisconnectLink: (parent: BtNode, child: BtNode) => void;
  onRemoveTag: (tag: TagNode) => void;
  onTagSelected: (tag: TagNode) => void;
  onTagModified: () => void;
}

export class WireRenderer {
  public static renderExecutionWires(
    layer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
    links: { source: BtNode; target: BtNode }[],
    customModels: NodeModel[],
    callbacks: WireRendererCallbacks
  ) {
    const selection = layer.selectAll<SVGPathElement, { source: BtNode; target: BtNode }>('path.wire')
      .data(links, d => `${d.source.id}->${d.target.id}`);

    selection.exit().remove();

    const enter = selection.enter().append('path').attr('class', 'wire');
    const all = enter.merge(selection as any);

    all
      .attr('id', d => `wire-${d.source.id}-${d.target.id}`)
      .attr('d', d => {
        const outSockets = CanvasLayoutService.getNodeOutputSockets(d.source);
        const hasDualOut = outSockets.length > 1;
        const sIdx = d.source.children.indexOf(d.target);
        const portType = d.target.parentPort || ((hasDualOut && sIdx > 0) ? 'failure' : (hasDualOut ? 'success' : 'out'));

        const sPos = CanvasLayoutService.getSocketCoords(d.source, portType as any, customModels);
        const tPos = CanvasLayoutService.getSocketCoords(d.target, 'in', customModels);
        return computeBezierWire(sPos.x, sPos.y, tPos.x, tPos.y);
      })
      .attr('class', d => {
        let cls = 'wire fill-none stroke-[2.5px] stroke-round cursor-pointer transition-[stroke,stroke-width] duration-150 hover:!stroke-destructive hover:!stroke-[3.5px]';
        const outSockets = CanvasLayoutService.getNodeOutputSockets(d.source);
        const hasDualOut = outSockets.length > 1;
        const sIdx = d.source.children.indexOf(d.target);
        const portType = d.target.parentPort || ((hasDualOut && sIdx > 0) ? 'failure' : (hasDualOut ? 'success' : 'out'));

        if (portType === 'failure') cls += ' stroke-red-500 [stroke-dasharray:8_6]';
        else if (portType === 'success') cls += ' stroke-emerald-500';
        else cls += ' stroke-blue-500 dark:stroke-blue-400';

        if (d.target.status === NodeStatus.RUNNING) cls += ' stroke-amber-500 [stroke-dasharray:8_6] [animation:wire-flow_0.8s_linear_infinite]';
        else if (d.target.status === NodeStatus.SUCCESS) cls += ' !stroke-emerald-500';
        else if (d.target.status === NodeStatus.FAILURE) cls += ' !stroke-red-500';
        return cls;
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (confirm(`Disconnect link between ${d.source.name} and ${d.target.name}?`)) {
          callbacks.onDisconnectLink(d.source, d.target);
        }
      });
  }

  public static renderDataWires(
    layer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
    tagNodes: TagNode[],
    allNodes: BtNode[],
    customModels: NodeModel[],
    callbacks: WireRendererCallbacks
  ) {
    const selection = layer.selectAll<SVGPathElement, TagNode>('path.wire-data')
      .data(tagNodes, d => d.id);

    selection.exit().remove();

    const enter = selection.enter().append('path').attr('class', 'wire wire-data');
    const all = enter.merge(selection as any);

    all
      .attr('id', d => `data-wire-${d.id}`)
      .attr('class', 'wire wire-data fill-none stroke-[2.5px] stroke-sky-500 [stroke-dasharray:8_6] stroke-round cursor-pointer transition-[stroke,stroke-width] duration-150 hover:!stroke-destructive hover:!stroke-[3.5px]')
      .attr('d', d => {
        const targetNode = allNodes.find(n => n.id === d.targetNodeId);
        if (!targetNode) return '';
        const targetPos = CanvasLayoutService.getParameterSocketCoords(targetNode, d.targetPortName, customModels);
        return computeBezierWire(d.x + 67.5, d.y, targetPos.x, targetPos.y);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (confirm(`Remove tag '${d.name}' connected to parameter?`)) {
          callbacks.onRemoveTag(d);
        }
      });
  }

  public static renderTagNodes(
    layer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
    dataWiresLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
    tagNodes: TagNode[],
    allNodes: BtNode[],
    selectedTag: TagNode | null,
    customModels: NodeModel[],
    callbacks: WireRendererCallbacks
  ) {
    const selection = layer.selectAll<SVGGElement, TagNode>('g.tag-node')
      .data(tagNodes, d => d.id);

    selection.exit().remove();

    const enter = selection.enter().append('g')
      .attr('class', 'tag-node cursor-grab active:cursor-grabbing group')
      .attr('data-id', d => d.id);

    const tagDrag = d3.drag<SVGGElement, TagNode>()
      .on('start', function () {
        d3.select(this).raise();
      })
      .on('drag', function (event, d) {
        d.x += event.dx;
        d.y += event.dy;
        d3.select(this).attr('transform', `translate(${d.x},${d.y})`);

        const targetNode = allNodes.find(n => n.id === d.targetNodeId);
        if (targetNode) {
          const targetPos = CanvasLayoutService.getParameterSocketCoords(targetNode, d.targetPortName, customModels);
          dataWiresLayer.select(`#data-wire-${d.id}`)
            .attr('d', computeBezierWire(d.x + 67.5, d.y, targetPos.x, targetPos.y));
        }
      });

    enter.call(tagDrag as any);

    enter.each(function (d) {
      const g = d3.select(this);
      const cardW = 135;
      const cardH = 48;

      // 1. Unified Card Container
      g.append('rect')
        .attr('class', 'node-card fill-[var(--node-bg)] stroke-[var(--node-border)] stroke-[1.5px] [filter:drop-shadow(0_6px_14px_rgba(0,0,0,0.16))] transition-[stroke,fill,filter] duration-150')
        .attr('width', cardW)
        .attr('height', cardH)
        .attr('x', -cardW / 2)
        .attr('y', -cardH / 2)
        .attr('rx', 8)
        .attr('ry', 8);

      // Blackboard data accent strip
      g.append('rect')
        .attr('class', 'transition-colors duration-150')
        .attr('x', -cardW / 2 + 2.5)
        .attr('y', -cardH / 2 + 6)
        .attr('width', 3)
        .attr('height', cardH - 12)
        .attr('rx', 1.5)
        .attr('fill', '#8b5cf6');

      // 2. Header Row
      g.append('text')
        .attr('class', 'fill-foreground font-sans font-semibold text-[11px] select-none pointer-events-none')
        .attr('x', -cardW / 2 + 10)
        .attr('y', -cardH / 2 + 16)
        .text(d.name.length > 12 ? d.name.substring(0, 10) + '..' : d.name);

      const typeStr = d.dataType ? (d.dataType.split('::').pop() || d.dataType) : 'string';
      const badgeW = 48;
      const badgeH = 15;
      const badgeX = cardW / 2 - badgeW - 8;
      const badgeY = -cardH / 2 + 6;

      const badgeG = g.append('g')
        .attr('class', 'select-none pointer-events-none')
        .attr('transform', `translate(${badgeX}, ${badgeY})`);

      badgeG.append('rect')
        .attr('class', 'fill-secondary stroke-border stroke-[0.5px] rx-1')
        .attr('width', badgeW)
        .attr('height', badgeH)
        .attr('rx', 4);

      badgeG.append('text')
        .attr('class', 'fill-foreground font-mono text-[8px] font-semibold select-none pointer-events-none')
        .attr('x', badgeW / 2)
        .attr('y', 11)
        .attr('text-anchor', 'middle')
        .text(typeStr.length > 8 ? typeStr.substring(0, 7) + '.' : typeStr);

      // 3. Body: Value Inset Box
      const valBoxW = cardW - 16;
      const valBoxH = 18;
      const valBoxX = -cardW / 2 + 8;
      const valBoxY = -cardH / 2 + 24;

      g.append('rect')
        .attr('class', 'fill-muted stroke-border stroke-[0.75px] hover:fill-secondary hover:stroke-ring transition-colors duration-150 rx-1 cursor-pointer')
        .attr('x', valBoxX)
        .attr('y', valBoxY)
        .attr('width', valBoxW)
        .attr('height', valBoxH)
        .attr('rx', 4);

      g.append('text')
        .attr('class', 'fill-foreground font-mono text-[9px] font-medium cursor-pointer')
        .attr('x', valBoxX + 6)
        .attr('y', valBoxY + 12.5)
        .text(d.value.length > 15 ? d.value.substring(0, 13) + '..' : (d.value || '""'))
        .on('click', (event) => {
          event.stopPropagation();
          const newVal = prompt(`Enter value for tag ${d.name} (${d.dataType}):`, d.value);
          if (newVal !== null) {
            d.value = newVal;
            const targetNode = allNodes.find(n => n.id === d.targetNodeId);
            if (targetNode) {
              targetNode.attributes[d.targetPortName] = newVal;
            }
            callbacks.onTagModified();
          }
        });

      // Output pin on right edge
      const tagPin = g.append('g')
        .attr('class', 'cursor-crosshair group/pin')
        .attr('transform', `translate(${cardW / 2}, 0)`);

      tagPin.append('circle').attr('r', 10).attr('fill', 'transparent');
      tagPin.append('circle')
        .attr('class', 'fill-[var(--node-bg)] transition-transform duration-150 group-hover/pin:scale-125')
        .attr('r', 4.5)
        .attr('stroke', '#0284c7')
        .attr('stroke-width', 1.5);
      tagPin.append('circle')
        .attr('class', 'pointer-events-none')
        .attr('r', 1.8)
        .attr('fill', '#0284c7');
    });

    enter.on('click', (event, d) => {
      event.stopPropagation();
      callbacks.onTagSelected(d);
    });

    const allTagNodes = enter.merge(selection as any);
    allTagNodes
      .classed('selected', d => selectedTag === d)
      .attr('data-id', d => d.id)
      .attr('transform', d => `translate(${d.x},${d.y})`);
  }

  public static updateAllWires(
    wiresLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
    dataWiresLayer: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
    allNodes: BtNode[],
    tagNodes: TagNode[],
    customModels: NodeModel[]
  ) {
    allNodes.forEach(curr => {
      if (curr.children && !NodeShapeRegistry.isContainer(curr)) {
        curr.children.forEach(child => {
          const outSockets = CanvasLayoutService.getNodeOutputSockets(curr);
          const hasDualOut = outSockets.length > 1;
          const sIdx = curr.children.indexOf(child);
          const portType = child.parentPort || ((hasDualOut && sIdx > 0) ? 'failure' : (hasDualOut ? 'success' : 'out'));
          const sPos = CanvasLayoutService.getSocketCoords(curr, portType as any, customModels);
          const tPos = CanvasLayoutService.getSocketCoords(child, 'in', customModels);
          wiresLayer.select(`#wire-${curr.id}-${child.id}`)
            .attr('d', computeBezierWire(sPos.x, sPos.y, tPos.x, tPos.y));
        });
      }
    });

    tagNodes.forEach(tag => {
      const targetNode = allNodes.find(n => n.id === tag.targetNodeId);
      if (targetNode) {
        const targetPos = CanvasLayoutService.getParameterSocketCoords(targetNode, tag.targetPortName, customModels);
        dataWiresLayer.select(`#data-wire-${tag.id}`)
          .attr('d', computeBezierWire(tag.x + 67.5, tag.y, targetPos.x, targetPos.y));
      }
    });
  }
}
