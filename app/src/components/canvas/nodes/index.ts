import * as d3 from 'd3';
import { BtNode, NodeModel } from '../../../types';
import { CanvasLayoutService } from '../canvas-layout';
import { NodeShapeRegistry } from './registry';
import { NodeRendererCallbacks } from './types';

export * from './types';
export * from './registry';
export * from './common/sockets';
export * from './common/ports';
export * from './common/badges';
export * from './shapes/standard-card';
export * from './shapes/sequence-bracket';
export * from './shapes/fallback-card';
export * from './shapes/decorator-card';

export class NodeRenderer {
  public static renderNodes(
    selection: d3.Selection<SVGGElement, BtNode, any, unknown>,
    customModels: NodeModel[],
    callbacks: NodeRendererCallbacks
  ) {
    selection.each(function (d) {
      const g = d3.select(this);
      g.selectAll('*').remove();

      const renderer = NodeShapeRegistry.getRenderer(d);
      const w = renderer.getWidth(d);
      const h = renderer.getHeight(d, customModels);

      renderer.render(g, d, w, h, customModels, callbacks);
    });
  }
}
