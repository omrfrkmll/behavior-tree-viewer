import * as d3 from 'd3';
import { BtNode, NodeModel } from '../../../../types';
import { CANVAS_CONSTANTS } from '../../canvas-layout';
import { NodeRendererCallbacks } from '../types';

export class PortsHelper {
  public static renderParameterPorts(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    node: BtNode,
    width: number,
    startY: number,
    customModels: NodeModel[],
    callbacks: NodeRendererCallbacks
  ) {
    const model = customModels.find(m => m.name === node.name);
    const ports = model?.ports || [];
    if (ports.length === 0) return;

    ports.forEach((p, idx) => {
      const rowY = startY + (idx * CANVAS_CONSTANTS.ROW_HEIGHT);
      const val = node.attributes[p.name] ?? p.defaultValue ?? '';
      const isInput = p.direction === 'input';

      // Row Hover Background
      g.append('rect')
        .attr('class', 'fill-transparent hover:fill-secondary/60 transition-colors duration-100 cursor-default rx-1')
        .attr('x', -width / 2 + 8)
        .attr('y', rowY - 10)
        .attr('width', width - 16)
        .attr('height', 20)
        .attr('rx', 4);

      // Port Direction & Label
      g.append('text')
        .attr('class', `font-mono text-[10px] font-medium select-none pointer-events-none ${
          isInput ? 'fill-sky-600 dark:fill-sky-400' : 'fill-emerald-600 dark:fill-emerald-400'
        }`)
        .attr('x', -width / 2 + 14)
        .attr('y', rowY + 4)
        .text(`${isInput ? '▶' : '◀'} ${p.name}`);

      // Port Combobox Select Box
      const selectW = 86;
      const selectH = 17;
      const selectX = width / 2 - selectW - 12;
      const selectY = rowY - 8.5;

      const selectBox = g.append('g')
        .attr('class', 'cursor-pointer')
        .attr('transform', `translate(${selectX}, ${selectY})`)
        .on('mousedown', (event) => {
          event.stopPropagation();
        })
        .on('click', function (event) {
          event.stopPropagation();
          const rect = (this as SVGGElement).getBoundingClientRect();
          callbacks.onShowPortSelect(node, p.name, rect);
        });

      selectBox.append('rect')
        .attr('class', 'fill-muted stroke-border stroke-[0.75px] hover:fill-secondary hover:stroke-ring transition-colors duration-150 rx-1')
        .attr('width', selectW)
        .attr('height', selectH)
        .attr('rx', 4);

      selectBox.append('text')
        .attr('class', 'fill-foreground font-mono text-[9.5px] font-medium select-none pointer-events-none')
        .attr('data-port-name', p.name)
        .attr('x', 6)
        .attr('y', 11.5)
        .text(val.length > 11 ? val.substring(0, 9) + '..' : (val || 'set val'));

      selectBox.append('text')
        .attr('class', 'fill-muted-foreground text-[8px] select-none pointer-events-none')
        .attr('x', selectW - 9)
        .attr('y', 11.5)
        .text('▾');

      // Parameter Connection Pin
      const portPin = g.append('g')
        .attr('class', 'cursor-crosshair group/pin')
        .attr('transform', `translate(${isInput ? -width / 2 : width / 2}, ${rowY})`)
        .on('mousedown', (event) => {
          event.stopPropagation();
          callbacks.onStartConnectingParam(node, p.name, p.type || 'string');
        });

      portPin.append('circle').attr('r', 10).attr('fill', 'transparent');
      portPin.append('circle')
        .attr('class', 'fill-[var(--node-bg)] transition-transform duration-150 group-hover/pin:scale-125')
        .attr('r', 4.5)
        .attr('stroke', isInput ? '#0284c7' : '#16a34a')
        .attr('stroke-width', 1.5);
      portPin.append('circle')
        .attr('class', 'pointer-events-none')
        .attr('r', 1.8)
        .attr('fill', isInput ? '#0284c7' : '#16a34a');
    });
  }
}
