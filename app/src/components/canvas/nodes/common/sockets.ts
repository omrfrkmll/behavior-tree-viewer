import * as d3 from 'd3';
import { BtNode } from '../../../../types';
import { NodeRendererCallbacks, SocketType } from '../types';

export class SocketsHelper {
  public static renderInSocket(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    x: number,
    y: number,
    node: BtNode,
    callbacks: NodeRendererCallbacks
  ) {
    const inSocket = g.append('g')
      .attr('class', 'cursor-crosshair group/pin socket-in')
      .attr('transform', `translate(${x}, ${y})`)
      .on('mousedown', (event) => {
        event.stopPropagation();
        callbacks.onStartConnecting(node, 'from-in', 'in');
      });

    inSocket.append('circle').attr('r', 12).attr('fill', 'transparent');
    inSocket.append('circle')
      .attr('class', 'fill-[var(--node-bg)] transition-transform duration-150 group-hover/pin:scale-125')
      .attr('r', 5)
      .attr('stroke', '#0284c7')
      .attr('stroke-width', 1.8);
    inSocket.append('circle')
      .attr('class', 'pointer-events-none')
      .attr('r', 2)
      .attr('fill', '#0284c7');

    return inSocket;
  }

  public static renderOutSocket(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    x: number,
    y: number,
    node: BtNode,
    portType: SocketType,
    callbacks: NodeRendererCallbacks,
    strokeColor: string = '#3b82f6'
  ) {
    const socket = g.append('g')
      .attr('class', `cursor-crosshair group/pin socket-out socket-${portType}`)
      .attr('transform', `translate(${x}, ${y})`)
      .on('mousedown', (event) => {
        event.stopPropagation();
        callbacks.onStartConnecting(node, 'from-out', portType);
      });

    socket.append('circle').attr('r', 12).attr('fill', 'transparent');
    socket.append('circle')
      .attr('class', 'fill-[var(--node-bg)] transition-transform duration-150 group-hover/pin:scale-125')
      .attr('r', 5)
      .attr('stroke', strokeColor)
      .attr('stroke-width', 1.8);
    socket.append('circle')
      .attr('class', 'pointer-events-none')
      .attr('r', 2)
      .attr('fill', strokeColor);

    return socket;
  }

  public static renderDualOutputSockets(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    x: number,
    ySuccess: number,
    yFailure: number,
    node: BtNode,
    callbacks: NodeRendererCallbacks
  ) {
    this.renderOutSocket(g, x, ySuccess, node, 'success', callbacks, '#16a34a');
    this.renderOutSocket(g, x, yFailure, node, 'failure', callbacks, '#dc2626');
  }
}
