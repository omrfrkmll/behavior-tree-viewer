import { BtNode } from '../../../types';
import { NodeShapeRenderer } from './types';
import { StandardCardShape } from './shapes/standard-card';
import { SequenceBracketShape } from './shapes/sequence-bracket';
import { FallbackCardShape } from './shapes/fallback-card';
import { DecoratorCardShape } from './shapes/decorator-card';

type MatcherFn = (node: BtNode) => boolean;

interface RegisteredShapeEntry {
  renderer: NodeShapeRenderer;
  matcher: MatcherFn;
}

export class NodeShapeRegistry {
  private static defaultShape: NodeShapeRenderer = new StandardCardShape();
  private static registry: RegisteredShapeEntry[] = [];

  static {
    // 1. Sequence container (Sequence, ReactiveSequence, PipelineSequence, etc.)
    this.register(
      new SequenceBracketShape(),
      node => node.name.toLowerCase().includes('sequence')
    );

    // 2. Fallback / Recovery dual-output card
    this.register(
      new FallbackCardShape(),
      node => node.name === 'Fallback' || node.name === 'RecoveryNode'
    );

    // 3. Decorator category nodes (Inverter, Retry, Timeout, etc.)
    this.register(
      new DecoratorCardShape(),
      node => node.category === 'Decorator'
    );
  }

  /**
   * Register a custom node shape renderer with a matcher function.
   * New custom shapes take precedence over older registrations.
   */
  public static register(renderer: NodeShapeRenderer, matcher: MatcherFn): void {
    // Insert at beginning for precedence override
    this.registry.unshift({ renderer, matcher });
  }

  /**
   * Retrieves matching shape renderer for a given behavior tree node.
   * Returns StandardCardShape if no specific matcher matches.
   */
  public static getRenderer(node: BtNode): NodeShapeRenderer {
    for (const entry of this.registry) {
      if (entry.matcher(node)) {
        return entry.renderer;
      }
    }
    return this.defaultShape;
  }

  /**
   * Checks if node is treated as an internal container (e.g. C-bracket)
   */
  public static isContainer(node: BtNode): boolean {
    const renderer = this.getRenderer(node);
    return Boolean(renderer.isContainer);
  }
}
