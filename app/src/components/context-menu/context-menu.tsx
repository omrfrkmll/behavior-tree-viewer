import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';
import { BtNode, TagNode } from '../../types';
import {
  Search,
  Copy,
  Trash2,
  Unlink,
  Plus,
  Zap,
  HelpCircle,
  LayoutGrid,
  Focus,
  Download
} from 'lucide-react';

export interface ContextMenuCallbacks {
  onDeleteNode: (node: BtNode) => void;
  onDuplicateNode: (node: BtNode) => void;
  onInspectNode: (node: BtNode) => void;
  onDeleteTag: (tag: TagNode) => void;
  onDisconnectTag: (tag: TagNode) => void;
  onDisconnectLink: (source: BtNode, target: BtNode) => void;
  onAddNode: (modelName: string, category: string, x: number, y: number) => void;
  onAutoLayout: () => void;
  onResetView: () => void;
  onExportXml: () => void;
}

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  divider?: boolean;
  onClick: () => void;
}

interface ContextMenuModalProps {
  header: string;
  items: MenuItem[];
  position: { left: number; top: number };
  onClose: () => void;
}

const ContextMenuModal: React.FC<ContextMenuModalProps> = ({
  header,
  items,
  position,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      id="custom-context-menu"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      className="fixed z-50 min-w-[13rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md select-none animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out duration-100 font-sans"
    >
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
        {header}
      </div>
      <div className="-mx-1 my-1 h-px bg-border" />
      <div className="flex flex-col gap-0.5">
        {items.map((item, idx) => {
          if (item.divider) {
            return <div key={`div-${idx}`} className="-mx-1 my-1 h-px bg-border" />;
          }

          const itemCls = item.danger
            ? 'group relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors text-left'
            : 'group relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground text-popover-foreground transition-colors text-left';

          return (
            <button
              key={`${item.label}-${idx}`}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                onClose();
              }}
              className={itemCls}
            >
              {item.icon && (
                <span className="mr-2 flex h-4 w-4 items-center justify-center text-muted-foreground group-hover:text-foreground [&_svg]:h-4 [&_svg]:w-4">
                  {item.icon}
                </span>
              )}
              <span className="font-medium">{item.label}</span>
              {item.shortcut && (
                <span className="ml-auto pl-3 text-[10px] tracking-widest text-muted-foreground font-mono">
                  {item.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export class ContextMenuComponent {
  private static rootContainer: HTMLDivElement | null = null;
  private static reactRoot: ReturnType<typeof createRoot> | null = null;

  constructor(private callbacks: ContextMenuCallbacks) {
    this.initGlobalEvents();
  }

  private initGlobalEvents() {
    window.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
      this.handleContextMenu(event);
    });

    window.addEventListener('resize', () => this.hide());
    window.addEventListener('scroll', () => this.hide(), true);
  }

  private handleContextMenu(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const clientX = event.clientX;
    const clientY = event.clientY;

    const nodeEl = target.closest('.blender-node') as HTMLElement | null;
    if (nodeEl) {
      const nodeData = (d3.select(nodeEl).datum() as BtNode | undefined);
      if (nodeData) {
        this.showNodeMenu(nodeData, clientX, clientY);
        return;
      }
    }

    const tagEl = target.closest('.tag-node') as HTMLElement | null;
    if (tagEl) {
      const tagData = (d3.select(tagEl).datum() as TagNode | undefined);
      if (tagData) {
        this.showTagMenu(tagData, clientX, clientY);
        return;
      }
    }

    const wireEl = target.closest('path.wire') as SVGPathElement | null;
    if (wireEl && !wireEl.classList.contains('active-drawing')) {
      const wireData = (d3.select(wireEl).datum() as { source: BtNode; target: BtNode } | TagNode | undefined);
      if (wireData && 'source' in wireData && 'target' in wireData) {
        this.showWireMenu(wireData.source, wireData.target, clientX, clientY);
        return;
      }
    }

    this.showCanvasMenu(clientX, clientY);
  }

  private showNodeMenu(node: BtNode, x: number, y: number) {
    const items: MenuItem[] = [
      {
        label: 'Inspect & Edit Properties',
        icon: <Search />,
        onClick: () => this.callbacks.onInspectNode(node)
      },
      {
        label: 'Duplicate Node',
        icon: <Copy />,
        shortcut: 'Ctrl+D',
        onClick: () => this.callbacks.onDuplicateNode(node)
      },
      {
        divider: true,
        label: '',
        onClick: () => {}
      },
      {
        label: 'Delete Node',
        icon: <Trash2 />,
        shortcut: 'Del',
        danger: true,
        onClick: () => this.callbacks.onDeleteNode(node)
      }
    ];

    this.renderMenu(`Node: ${node.name}`, items, x, y);
  }

  private showTagMenu(tag: TagNode, x: number, y: number) {
    const items: MenuItem[] = [
      {
        label: `Disconnect from ${tag.targetPortName}`,
        icon: <Unlink />,
        onClick: () => this.callbacks.onDisconnectTag(tag)
      },
      {
        divider: true,
        label: '',
        onClick: () => {}
      },
      {
        label: 'Delete Blackboard Tag',
        icon: <Trash2 />,
        danger: true,
        shortcut: 'Del',
        onClick: () => this.callbacks.onDeleteTag(tag)
      }
    ];

    this.renderMenu(`Tag: ${tag.name}`, items, x, y);
  }

  private showWireMenu(source: BtNode, target: BtNode, x: number, y: number) {
    const items: MenuItem[] = [
      {
        label: `Disconnect ${source.name} ➔ ${target.name}`,
        icon: <Unlink />,
        danger: true,
        onClick: () => this.callbacks.onDisconnectLink(source, target)
      }
    ];

    this.renderMenu('Link Connection', items, x, y);
  }

  private showCanvasMenu(x: number, y: number) {
    const items: MenuItem[] = [
      {
        label: 'Add Sequence Node',
        icon: <Plus />,
        onClick: () => this.callbacks.onAddNode('Sequence', 'Control', x, y)
      },
      {
        label: 'Add Fallback Node',
        icon: <Plus />,
        onClick: () => this.callbacks.onAddNode('Fallback', 'Control', x, y)
      },
      {
        label: 'Add Action Node',
        icon: <Zap />,
        onClick: () => this.callbacks.onAddNode('AlwaysSuccess', 'Action', x, y)
      },
      {
        label: 'Add Condition Node',
        icon: <HelpCircle />,
        onClick: () => this.callbacks.onAddNode('IsBatteryLow', 'Condition', x, y)
      },
      {
        divider: true,
        label: '',
        onClick: () => {}
      },
      {
        label: 'Auto Align Layout',
        icon: <LayoutGrid />,
        shortcut: 'Ctrl+L',
        onClick: () => this.callbacks.onAutoLayout()
      },
      {
        label: 'Reset Canvas View',
        icon: <Focus />,
        shortcut: 'Home',
        onClick: () => this.callbacks.onResetView()
      },
      {
        label: 'Export XML',
        icon: <Download />,
        shortcut: 'Ctrl+S',
        onClick: () => this.callbacks.onExportXml()
      }
    ];

    this.renderMenu('BehaviorTree Canvas', items, x, y);
  }

  private renderMenu(header: string, items: MenuItem[], x: number, y: number) {
    this.hide();

    const container = document.createElement('div');
    container.id = 'context-menu-root';
    document.body.appendChild(container);
    ContextMenuComponent.rootContainer = container;

    const menuWidth = 220;
    const menuHeight = 240;
    const posX = Math.min(window.innerWidth - menuWidth - 10, Math.max(10, x));
    const posY = Math.min(window.innerHeight - menuHeight - 10, Math.max(10, y));

    ContextMenuComponent.reactRoot = createRoot(container);
    ContextMenuComponent.reactRoot.render(
      <ContextMenuModal
        header={header}
        items={items}
        position={{ left: posX, top: posY }}
        onClose={() => this.hide()}
      />
    );
  }

  public hide() {
    if (ContextMenuComponent.reactRoot) {
      ContextMenuComponent.reactRoot.unmount();
      ContextMenuComponent.reactRoot = null;
    }
    if (ContextMenuComponent.rootContainer) {
      ContextMenuComponent.rootContainer.remove();
      ContextMenuComponent.rootContainer = null;
    }
  }
}
