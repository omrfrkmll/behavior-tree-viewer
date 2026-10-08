import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { SlidersHorizontal } from 'lucide-react';
import { BtNode } from '../../types';
import { getCategoryColor } from '../../utils/category';

export interface AppLayoutProps {
  navbar: React.ReactNode;
  sidebarTabs: React.ReactNode;
  palette: React.ReactNode;
  explorer: React.ReactNode;
  blackboard: React.ReactNode;
  inspector: React.ReactNode;
  codeDrawer: React.ReactNode;
  zoomControls?: React.ReactNode;
  activeTab: 'palette' | 'explorer' | 'tags';
  codeViewOpen: boolean;
  selectedNode: BtNode | null;
  gridMode: 'dots' | 'lines' | 'empty';
  onGridModeChange: (mode: 'dots' | 'lines' | 'empty') => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  navbar,
  sidebarTabs,
  palette,
  explorer,
  blackboard,
  inspector,
  codeDrawer,
  zoomControls,
  activeTab,
  codeViewOpen,
  selectedNode,
  gridMode,
  onGridModeChange
}) => {
  const [drawerWidth, setDrawerWidth] = React.useState<number>(460);
  const [isResizing, setIsResizing] = React.useState<boolean>(false);

  const startResizing = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startW = drawerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(300, Math.min(window.innerWidth - 320, startW + delta));
      setDrawerWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [drawerWidth]);

  return (
    <div id="app" className="flex flex-col w-full h-full">
      {/* Top Navbar Mount */}
      <header
        id="top-navbar"
        className="h-11 w-full border-b border-border bg-card px-3 flex items-center justify-between flex-shrink-0 select-none z-20"
      >
        {navbar}
      </header>

      {/* Main Studio Layout */}
      <div
        id="main-container"
        className="flex flex-1 h-[calc(100vh-44px)] w-screen overflow-hidden relative"
      >
        {/* Left Sidebar */}
        <aside
          id="left-sidebar"
          className="w-[270px] flex-shrink-0 h-full bg-card border-r border-border flex flex-col z-10"
        >
          <div className="sidebar-tabs p-2 border-b border-border bg-card">
            {sidebarTabs}
          </div>
          <div
            id="palette-view"
            className={`sidebar-pane flex-1 overflow-y-auto flex-col ${activeTab === 'palette' ? 'flex' : 'hidden'}`}
          >
            {palette}
          </div>
          <div
            id="explorer-view"
            className={`sidebar-pane flex-1 overflow-y-auto flex-col ${activeTab === 'explorer' ? 'flex' : 'hidden'}`}
          >
            {explorer}
          </div>
          <div
            id="tags-view"
            className={`sidebar-pane flex-1 overflow-y-auto flex-col ${activeTab === 'tags' ? 'flex' : 'hidden'}`}
          >
            {blackboard}
          </div>
        </aside>

        {/* Center Blueprint Canvas */}
        <main
          id="canvas-container"
          className="relative flex-1 h-full w-full overflow-hidden bg-background"
        >
          {/* Blueprint Grid Pattern */}
          <div
            id="blueprint-grid"
            className={`absolute inset-0 w-full h-full pointer-events-none ${
              gridMode === 'empty' ? 'grid-empty' : gridMode === 'lines' ? 'grid-lines' : 'grid-dots'
            }`}
          />

          {/* Floating Canvas Grid Controls */}
          <div
            id="canvas-grid-controls"
            className="absolute top-3 right-3 inline-flex items-center rounded-lg bg-muted p-1 text-muted-foreground shadow-xs z-10 gap-0.5"
          >
            <Button
              type="button"
              variant={gridMode === 'dots' ? 'default' : 'ghost'}
              size="xs"
              onClick={() => onGridModeChange('dots')}
              title="Dot Grid"
              className={gridMode === 'dots' ? 'shadow-xs' : 'text-muted-foreground hover:text-foreground'}
            >
              Dots
            </Button>
            <Button
              type="button"
              variant={gridMode === 'lines' ? 'default' : 'ghost'}
              size="xs"
              onClick={() => onGridModeChange('lines')}
              title="Square Grid"
              className={gridMode === 'lines' ? 'shadow-xs' : 'text-muted-foreground hover:text-foreground'}
            >
              Grid
            </Button>
            <Button
              type="button"
              variant={gridMode === 'empty' ? 'default' : 'ghost'}
              size="xs"
              onClick={() => onGridModeChange('empty')}
              title="Plain Empty"
              className={gridMode === 'empty' ? 'shadow-xs' : 'text-muted-foreground hover:text-foreground'}
            >
              Empty
            </Button>
          </div>

          <svg id="tree-svg" className="w-full h-full block cursor-grab active:cursor-grabbing">
            <defs>
              <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000000" floodOpacity="0.16" />
              </filter>
              <filter id="glow-running" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.45" />
              </filter>
              <filter id="glow-success" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.45" />
              </filter>
              <filter id="glow-failure" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ef4444" floodOpacity="0.45" />
              </filter>
            </defs>
            <g id="viewport-group">
              <g id="data-wires-layer" />
              <g id="wires-layer" />
              <g id="tag-nodes-layer" />
              <g id="nodes-layer" />
              <g id="temp-layer" style={{ pointerEvents: 'none' }} />
            </g>
          </svg>

          {/* Live Code View Resizable Drawer Mount */}
          {codeViewOpen && (
            <div
              id="code-view-drawer"
              style={{ width: `${drawerWidth}px` }}
              className={`code-drawer absolute top-0 right-0 h-full bg-card border-l border-border shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-150 ${
                isResizing ? 'select-none pointer-events-auto transition-none' : ''
              }`}
            >
              {/* Left Resize Handle */}
              <div
                onMouseDown={startResizing}
                onDoubleClick={() => setDrawerWidth(460)}
                title="Drag to resize drawer, double-click to reset"
                className="absolute left-0 top-0 bottom-0 w-3 -translate-x-1.5 cursor-ew-resize group z-40 flex items-center justify-center select-none"
              >
                <div className="w-1 h-14 rounded-full bg-border group-hover:bg-primary group-active:bg-primary transition-colors shadow-xs" />
              </div>

              {codeDrawer}
            </div>
          )}

          {/* Canvas Floating HUD with shadcn Badges */}
          <div
            id="canvas-overlay-hud"
            className="absolute bottom-3 left-3 flex items-center gap-1.5 pointer-events-none z-10 select-none"
          >
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-[11px] font-sans font-normal bg-card shadow-xs">
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-sans font-medium text-foreground">
                Left Drag
              </kbd>
              Move / Marquee
            </Badge>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-[11px] font-sans font-normal bg-card shadow-xs">
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-sans font-medium text-foreground">
                Middle Click
              </kbd>
              Pan
            </Badge>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-[11px] font-sans font-normal bg-card shadow-xs">
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-sans font-medium text-foreground">
                Right Click
              </kbd>
              Menu
            </Badge>
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-[11px] font-sans font-normal bg-card shadow-xs">
              <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-sans font-medium text-foreground">
                Del
              </kbd>
              Delete
            </Badge>
          </div>

          {/* Bottom-Right Zoom Controls */}
          {zoomControls}
        </main>

        {/* Right Inspector Panel Mount */}
        <aside
          id="inspector-panel"
          className="w-[290px] flex-shrink-0 h-full bg-card border-l border-border flex flex-col z-10 overflow-hidden"
        >
          <div className="h-11 px-3 border-b border-border bg-card flex items-center justify-between flex-shrink-0 select-none">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              <span className="font-semibold text-xs text-foreground">Node Inspector</span>
            </div>
            <span
              id="selected-node-badge"
              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-secondary text-secondary-foreground border border-border"
              style={{ color: selectedNode ? getCategoryColor(selectedNode.category) : undefined }}
            >
              {selectedNode ? selectedNode.category : 'None'}
            </span>
          </div>
          <div id="inspector-content" className="flex-1 overflow-y-auto overflow-x-hidden p-3 box-border">
            {inspector}
          </div>
        </aside>
      </div>
    </div>
  );
};
