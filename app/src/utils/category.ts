import { NodeCategory } from '../types';

export function getCategoryColor(category: NodeCategory): string {
  switch (category) {
    case NodeCategory.Control: return '#6366f1';    // Muted Indigo
    case NodeCategory.Decorator: return '#d97706';  // Muted Amber
    case NodeCategory.Action: return '#0284c7';     // Muted Blue
    case NodeCategory.Condition: return '#059669';  // Muted Emerald
    case NodeCategory.SubTree: return '#db2777';    // Muted Rose
    default: return '#71717a';
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
