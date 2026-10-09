import { NodeCategory } from '../types';

export function getCategoryColor(category: NodeCategory): string {
  switch (category) {
    case NodeCategory.Control: return 'var(--cat-control, #6366f1)';
    case NodeCategory.Decorator: return 'var(--cat-decorator, #d97706)';
    case NodeCategory.Action: return 'var(--cat-action, #0284c7)';
    case NodeCategory.Condition: return 'var(--cat-condition, #059669)';
    case NodeCategory.SubTree: return 'var(--cat-subtree, #db2777)';
    default: return 'var(--muted-foreground, #71717a)';
  }
}

export function detectCategory(tagName: string): NodeCategory {
  switch (tagName) {
    case 'Sequence':
    case 'Fallback':
    case 'ReactiveSequence':
    case 'ReactiveFallback':
    case 'Parallel':
    case 'PipelineSequence':
    case 'RecoveryNode':
    case 'RoundRobin':
      return NodeCategory.Control;
    case 'Inverter':
    case 'ForceSuccess':
    case 'ForceFailure':
    case 'Repeat':
    case 'RetryUntilSuccessful':
    case 'RateController':
    case 'DistanceController':
      return NodeCategory.Decorator;
    case 'SubTree':
    case 'SubTreePlus':
      return NodeCategory.SubTree;
    default:
      if (tagName.includes('Is') || tagName.includes('Reached') || tagName.includes('Available') || tagName.includes('Condition')) {
        return NodeCategory.Condition;
      }
      return NodeCategory.Action;
  }
}

export function getCategorySymbol(name: string, category: NodeCategory): string {
  switch (name) {
    case 'Sequence':
    case 'ReactiveSequence':
    case 'PipelineSequence':
      return '→';
    case 'Fallback':
    case 'ReactiveFallback':
    case 'RecoveryNode':
      return '?';
    case 'Parallel':
      return '⇉';
    case 'Repeat':
    case 'RetryUntilSuccessful':
    case 'DistanceController':
    case 'RateController':
      return '↺';
    case 'Inverter':
      return '!';
    case 'ForceSuccess':
      return '✓';
    case 'ForceFailure':
      return '✗';
    case 'SubTree':
    case 'SubTreePlus':
      return '🌲';
    default:
      if (category === NodeCategory.Condition) return '◆';
      if (category === NodeCategory.Action) return '⚙';
      return '•';
  }
}
