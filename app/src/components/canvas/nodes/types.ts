import * as d3 from 'd3';
import { BtNode, NodeModel } from '../../../types';

export interface NodeRendererCallbacks {
  onShowPortSelect: (node: BtNode, portName: string, triggerRect: DOMRect) => void;
  onStartConnecting: (
    node: BtNode,
    mode: 'from-out' | 'from-in',
    portType: 'success' | 'failure' | 'out' | 'in'
  ) => void;
  onStartConnectingParam: (node: BtNode, portName: string, portType: string) => void;
  onDetachSequenceChild: (seq: BtNode, child: BtNode, idx: number) => void;
  onNodeAddedToSequence: (seq: BtNode, newNode: BtNode) => void;
}

export type SocketType = 'in' | 'out' | 'success' | 'failure';

export interface NodeShapeRenderer {
  /**
   * Unique name or identifier for this shape renderer
   */
  readonly name: string;

  /**
   * Returns whether this shape is a container (like Sequence C-bracket) that holds internal children
   */
  readonly isContainer?: boolean;

  /**
   * Calculates width of the node
   */
  getWidth(node: BtNode): number;

  /**
   * Calculates height of the node (excluding child subtrees)
   */
  getHeight(node: BtNode, customModels: NodeModel[]): number;

  /**
   * Returns list of available execution output sockets
   */
  getOutputSockets?(node: BtNode): SocketType[];

  /**
   * Calculates exact canvas coordinate for a given flow socket
   */
  getSocketCoords?(
    node: BtNode,
    portType: SocketType,
    customModels: NodeModel[]
  ): { x: number; y: number };

  /**
   * Calculates exact canvas coordinate for a parameter socket
   */
  getParameterSocketCoords?(
    node: BtNode,
    portName: string,
    customModels: NodeModel[]
  ): { x: number; y: number };

  /**
   * Main D3 SVG render method for the node
   */
  render(
    g: d3.Selection<SVGGElement, BtNode, any, unknown>,
    node: BtNode,
    width: number,
    height: number,
    customModels: NodeModel[],
    callbacks: NodeRendererCallbacks
  ): void;
}
