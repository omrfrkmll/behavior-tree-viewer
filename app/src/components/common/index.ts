import { NodeCategory } from '../../types';
import { getCategoryColor } from '../../utils/category';

/**
 * Common reusable UI component builders and templates using Tailwind CSS
 */
export const CommonComponents = {
  /**
   * Renders a category badge with matching accent color
   */
  categoryBadge(category: NodeCategory, count?: number): string {
    const color = getCategoryColor(category);
    return `
      <span class="inline-flex items-center gap-1 text-[11px] font-medium text-foreground">
        <span style="color: ${color}">●</span>
        <span>${category}</span>
        ${count !== undefined ? `<span class="text-muted-foreground font-normal">(${count})</span>` : ''}
      </span>
    `;
  },

  /**
   * Renders a port direction badge
   */
  portDirectionBadge(direction: 'input' | 'output' | 'inout'): string {
    const isInput = direction === 'input';
    const cls = isInput
      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    return `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium uppercase ${cls}">${direction}</span>`;
  },

  /**
   * Renders a preset chip for parameter values or blackboard bindings
   */
  presetChip(key: string, value: string, label: string): string {
    return `<span class="preset-chip inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary hover:bg-accent text-secondary-foreground border border-border/80 cursor-pointer transition-colors shadow-xs" data-key="${key}" data-val="${value}" title="${value}">${label}</span>`;
  },

  /**
   * Renders a standardized empty state container
   */
  emptyState(title: string, subtitle?: string): string {
    return `
      <div class="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground gap-2 select-none">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" class="text-muted-foreground/60">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
        </svg>
        <p class="text-xs font-medium text-muted-foreground max-w-[200px]">${title}</p>
        ${subtitle ? `<span class="text-[10px] text-muted-foreground/70">${subtitle}</span>` : ''}
      </div>
    `;
  },

  /**
   * Renders a tree file card in workspace list
   */
  treeFileCard(fileName: string, subText = 'XML Tree File'): string {
    return `
      <div class="text-xs font-medium text-foreground truncate">${fileName}</div>
      <div class="text-[10px] text-muted-foreground">${subText}</div>
    `;
  }
};

export * from '../ui/button';
