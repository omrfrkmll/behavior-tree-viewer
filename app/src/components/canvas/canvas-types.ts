import { BehaviorTree, BtNode, NodeModel, TagNode } from '../../types';

export interface CanvasViewerCallbacks {
  onNodeSelected: (node: BtNode | null) => void;
  onTagSelected?: (tag: TagNode | null) => void;
  onTreeModified: () => void;
  onShowPortPopover: (node: BtNode, portName: string, anchor: DOMRect | { clientX: number; clientY: number }) => void;
  onHidePopover: () => void;
  onZoomChange?: (zoomPercent: number) => void;
}

export type GridMode = 'dots' | 'lines' | 'empty';

export type SocketType = 'in' | 'out' | 'success' | 'failure';
