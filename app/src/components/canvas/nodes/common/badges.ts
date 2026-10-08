import * as d3 from 'd3';
import { BtNode } from '../../../../types';
import { getCategoryColor, getCategorySymbol } from '../../../../utils/category';

export class BadgesHelper {
  public static renderCategoryStripe(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    x: number,
    y: number,
    height: number,
    category: string
  ) {
    return g.append('rect')
      .attr('class', 'category-accent-stripe transition-colors duration-150')
      .attr('x', x)
      .attr('y', y)
      .attr('width', 3)
      .attr('height', Math.max(0, height))
      .attr('rx', 1.5)
      .attr('fill', getCategoryColor(category));
  }

  public static renderSymbol(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    x: number,
    y: number,
    name: string,
    category: string
  ) {
    return g.append('text')
      .attr('class', 'fill-foreground font-mono font-bold text-[11px] select-none pointer-events-none')
      .attr('x', x)
      .attr('y', y)
      .text(getCategorySymbol(name, category));
  }

  public static renderNodeHeaderTitle(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    x: number,
    y: number,
    name: string,
    customName?: string,
    maxLen: number = 15
  ) {
    const textEl = g.append('text')
      .attr('class', 'fill-foreground font-sans font-semibold text-[11.5px] select-none pointer-events-none')
      .attr('x', x)
      .attr('y', y)
      .text(name.length > maxLen ? name.substring(0, maxLen - 1) + '..' : name);

    if (customName && customName !== name) {
      g.append('text')
        .attr('class', 'fill-muted-foreground font-mono text-[9.5px] select-none pointer-events-none')
        .attr('x', x)
        .attr('y', y + 12)
        .text(customName.length > 18 ? customName.substring(0, 16) + '..' : customName);
    }

    return textEl;
  }

  public static renderCategoryBadge(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    x: number,
    y: number,
    category: string,
    width: number = 54,
    height: number = 15
  ) {
    const badgeG = g.append('g')
      .attr('class', 'select-none pointer-events-none')
      .attr('transform', `translate(${x}, ${y})`);

    badgeG.append('rect')
      .attr('class', 'fill-secondary stroke-border stroke-[0.5px] rx-1')
      .attr('width', width)
      .attr('height', height)
      .attr('rx', 4);

    badgeG.append('text')
      .attr('class', 'font-mono text-[8.5px] font-semibold select-none pointer-events-none')
      .attr('x', width / 2)
      .attr('y', 11)
      .attr('text-anchor', 'middle')
      .attr('fill', getCategoryColor(category))
      .text(category);

    return badgeG;
  }

  public static renderOrderBadge(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    x: number,
    y: number,
    orderText: string,
    width: number = 28,
    height: number = 15
  ) {
    const badgeG = g.append('g')
      .attr('class', 'select-none pointer-events-none')
      .attr('transform', `translate(${x}, ${y})`);

    badgeG.append('rect')
      .attr('class', 'fill-secondary stroke-border stroke-[0.5px] rx-1')
      .attr('width', width)
      .attr('height', height)
      .attr('rx', 4);

    badgeG.append('text')
      .attr('class', 'fill-foreground font-mono text-[8.5px] font-semibold select-none pointer-events-none')
      .attr('x', width / 2)
      .attr('y', 11)
      .attr('text-anchor', 'middle')
      .text(orderText);

    return badgeG;
  }

  public static renderDetachButton(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    x: number,
    y: number,
    onClick: (event: MouseEvent) => void
  ) {
    const detachBtn = g.append('g')
      .attr('class', 'cursor-pointer opacity-80 hover:opacity-100 transition-opacity')
      .attr('transform', `translate(${x}, ${y})`)
      .on('click', (event) => {
        event.stopPropagation();
        onClick(event);
      });

    detachBtn.append('rect')
      .attr('width', 16)
      .attr('height', 16)
      .attr('rx', 3)
      .attr('class', 'fill-secondary hover:fill-destructive/15 transition-colors');

    detachBtn.append('text')
      .attr('x', 8)
      .attr('y', 11.5)
      .attr('text-anchor', 'middle')
      .attr('class', 'fill-destructive text-[10px] font-bold select-none pointer-events-none')
      .text('✕');

    return detachBtn;
  }
}
