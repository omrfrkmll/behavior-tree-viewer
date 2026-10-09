import React, { useState, useMemo } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Search,
  Star,
  Clock,
  Sparkles,
  Bot,
  Shield,
  Cpu,
  Layers,
  FileCode,
  LayoutGrid,
  List,
  Trash2,
  Plus,
  ArrowRight,
  FolderOpen,
  Upload,
  Workflow
} from 'lucide-react';
import { TREE_TEMPLATES, TreeTemplate } from '../../constants/templates';
import { RecentFileItem, RecentFilesService } from '../../features/recent/recent-files-service';
import { WelcomeFilterTab } from './welcome-sidebar';

export interface WelcomeScreenProps {
  activeFilter: WelcomeFilterTab;
  onFilterChange: (filter: WelcomeFilterTab) => void;
  onSelectTreeXml: (xmlContent: string, name?: string, filePath?: string) => void;
  onNewTree: () => void;
  onOpenFile: () => void;
  onOpenWorkspace: () => void;
  hasActiveTree: boolean;
  activeTreeName?: string;
  onResumeTree: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  activeFilter,
  onFilterChange,
  onSelectTreeXml,
  onNewTree,
  onOpenFile,
  onOpenWorkspace,
  hasActiveTree,
  activeTreeName,
  onResumeTree
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [recents, setRecents] = useState<RecentFileItem[]>(() => RecentFilesService.getRecents());

  // Subscribe to recents changes
  React.useEffect(() => {
    return RecentFilesService.subscribe(() => {
      setRecents(RecentFilesService.getRecents());
    });
  }, []);

  const handleToggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    RecentFilesService.toggleStar(id);
  };

  const handleRemoveRecent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    RecentFilesService.removeRecent(id);
  };

  // Filtered recent items
  const filteredRecents = useMemo(() => {
    return recents.filter(item => {
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchSearch) return false;
      if (activeFilter === 'starred') return item.starred;
      return true;
    });
  }, [recents, searchQuery, activeFilter]);

  // Filtered template items
  const filteredTemplates = useMemo(() => {
    if (activeFilter === 'recent') return [];
    return TREE_TEMPLATES.filter(tpl => {
      const matchSearch =
        tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (activeFilter === 'starred') return tpl.isDefaultDemo; // Default demo is starred
      return true;
    });
  }, [searchQuery, activeFilter]);

  // Format relative timestamp
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  // Render template icon helper
  const renderTemplateIcon = (type: TreeTemplate['iconType']) => {
    switch (type) {
      case 'robot':
        return <Bot className="size-6 text-primary" />;
      case 'shield':
        return <Shield className="size-6 text-emerald-500" />;
      case 'pipeline':
        return <Cpu className="size-6 text-cyan-500" />;
      case 'arm':
        return <Workflow className="size-6 text-amber-500" />;
      case 'plus':
      default:
        return <Sparkles className="size-6 text-primary" />;
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xml') || file.type.includes('xml')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          if (content) {
            onSelectTreeXml(content, file.name);
          }
        };
        reader.readAsText(file);
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex-1 h-full w-full overflow-y-auto bg-background/95 p-6 md:p-8 flex flex-col gap-8 select-none"
    >
      {/* Drag Over Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary backdrop-blur-xs z-50 flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <Upload className="size-12 text-primary animate-bounce mb-3" />
          <span className="text-lg font-semibold text-foreground">
            Drop XML File Here
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            The behavior tree will be parsed and loaded immediately
          </span>
        </div>
      )}

      {/* Top Hero Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              BehaviorTree Studio
            </h1>
            <Badge variant="outline" className="text-[10px] font-mono py-0.5">
              v4.x Compatible
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
            Design, visualize, and simulate ROS 2 and BehaviorTree.CPP v4 architectures in real-time.
          </p>
        </div>

        {/* Hero Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {hasActiveTree && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onResumeTree}
              className="gap-2 shadow-xs"
            >
              <span>{activeTreeName ? `Open "${activeTreeName}"` : 'Return to Canvas'}</span>
              <ArrowRight className="size-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenFile}
            className="gap-2 text-xs"
          >
            <FolderOpen className="size-3.5 text-muted-foreground" />
            Open File
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNewTree}
            className="gap-2 text-xs"
          >
            <Plus className="size-3.5" />
            New Tree
          </Button>
        </div>
      </div>

      {/* Featured Quick Start Cards (Adobe/Inventor Style Highlights) */}
      {activeFilter === 'all' && !searchQuery && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" />
              Quick Start Templates
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Default Demo Tree Card */}
            <div
              onClick={() => {
                const demo = TREE_TEMPLATES.find(t => t.id === 'default-warehouse');
                if (demo) onSelectTreeXml(demo.xmlContent, 'AutonomousWarehouseMission.xml');
              }}
              className="group relative flex flex-col justify-between p-4 rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card hover:border-primary hover:shadow-md cursor-pointer transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary group-hover:scale-105 transition-transform">
                  <Bot className="size-6" />
                </div>
                <Badge variant="default" className="text-[10px] bg-primary text-primary-foreground font-medium">
                  Default Demo
                </Badge>
              </div>

              <div className="mt-4 flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  Autonomous Warehouse Mission
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  Full-featured BT.CPP v4 architecture with Recovery, Parallel, ReactiveSequence, and Switch3 nodes.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono">~28 Nodes</span>
                <span className="text-primary font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Launch Demo <ArrowRight className="size-3" />
                </span>
              </div>
            </div>

            {/* 2. Blank Tree Card */}
            <div
              onClick={onNewTree}
              className="group relative flex flex-col justify-between p-4 rounded-xl border border-border bg-card hover:border-foreground/30 hover:shadow-md cursor-pointer transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground group-hover:scale-105 transition-transform">
                  <Plus className="size-6" />
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Clean Slate
                </Badge>
              </div>

              <div className="mt-4 flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  Blank Behavior Tree
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  Start from scratch with a root Sequence and blank canvas workspace.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono">Base Template</span>
                <span className="text-foreground font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Create <ArrowRight className="size-3" />
                </span>
              </div>
            </div>

            {/* 3. Reactive Patrol Card */}
            <div
              onClick={() => {
                const patrol = TREE_TEMPLATES.find(t => t.id === 'reactive-patrol');
                if (patrol) onSelectTreeXml(patrol.xmlContent, 'ReactivePatrolMission.xml');
              }}
              className="group relative flex flex-col justify-between p-4 rounded-xl border border-border bg-card hover:border-foreground/30 hover:shadow-md cursor-pointer transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-105 transition-transform">
                  <Shield className="size-6" />
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                  Reactive Safety
                </Badge>
              </div>

              <div className="mt-4 flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  Reactive Patrol & Guard
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  Battery safety fallback, emergency stop check, and dynamic waypoint patrol.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono">~12 Nodes</span>
                <span className="text-foreground font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Open Template <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area: Search + Filter Bar */}
      <div className="flex flex-col gap-4">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {activeFilter === 'recent'
                ? 'Recent Behavior Trees'
                : activeFilter === 'starred'
                ? 'Starred Trees'
                : activeFilter === 'templates'
                ? 'Template Trees'
                : 'All Trees & Templates'}
            </span>
            <Badge variant="secondary" className="text-xs">
              {filteredRecents.length + filteredTemplates.length}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search trees or templates..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-card"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-md border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === 'list'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="List View"
              >
                <List className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Render: Grid View */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Recent Files */}
            {filteredRecents.map(item => (
              <div
                key={item.id}
                onClick={() => onSelectTreeXml(item.xmlContent, item.name, item.filePath)}
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/60 hover:shadow-md cursor-pointer transition-all duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <FileCode className="size-5" />
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={e => handleToggleStar(e, item.id)}
                        className={`p-1 rounded hover:bg-muted transition-colors ${
                          item.starred ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title={item.starred ? 'Unstar' : 'Star'}
                      >
                        <Star className={`size-3.5 ${item.starred ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={e => handleRemoveRecent(e, item.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove from Recents"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-1">
                    <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate" title={item.name}>
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description || item.filePath || 'BehaviorTree XML document'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Clock className="size-3 opacity-60" />
                    <span>{formatTime(item.lastOpened)}</span>
                  </div>
                  {item.nodeCount && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                      {item.nodeCount} Nodes
                    </Badge>
                  )}
                </div>
              </div>
            ))}

            {/* Templates */}
            {filteredTemplates.map(tpl => (
              <div
                key={tpl.id}
                onClick={() => onSelectTreeXml(tpl.xmlContent, `${tpl.title}.xml`)}
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/60 hover:shadow-md cursor-pointer transition-all duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground group-hover:scale-105 transition-transform">
                      {renderTemplateIcon(tpl.iconType)}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {tpl.badge}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-col gap-1">
                    <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {tpl.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="font-mono">~{tpl.nodeCountEstimate} Nodes</span>
                  <span className="text-primary font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Use Template <ArrowRight className="size-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="flex flex-col border border-border rounded-xl bg-card overflow-hidden divide-y divide-border/60">
            {filteredRecents.map(item => (
              <div
                key={item.id}
                onClick={() => onSelectTreeXml(item.xmlContent, item.name, item.filePath)}
                className="group flex items-center justify-between px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileCode className="size-4 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {item.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {item.description || item.filePath || 'BehaviorTree XML File'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {formatTime(item.lastOpened)}
                  </span>
                  <button
                    type="button"
                    onClick={e => handleToggleStar(e, item.id)}
                    className={`p-1 rounded hover:bg-muted transition-colors ${
                      item.starred ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'
                    }`}
                  >
                    <Star className={`size-3.5 ${item.starred ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={e => handleRemoveRecent(e, item.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {filteredTemplates.map(tpl => (
              <div
                key={tpl.id}
                onClick={() => onSelectTreeXml(tpl.xmlContent, `${tpl.title}.xml`)}
                className="group flex items-center justify-between px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Sparkles className="size-4 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {tpl.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {tpl.description}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className="text-[10px]">
                    {tpl.badge}
                  </Badge>
                  <Button variant="ghost" size="xs" className="text-xs text-primary gap-1">
                    Use <ArrowRight className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredRecents.length === 0 && filteredTemplates.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-xl bg-card/50">
            <FileCode className="size-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">
              {searchQuery ? 'No Matching Trees Found' : 'No Items Found'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {searchQuery
                ? `No results found for "${searchQuery}". Try a different keyword or create a new tree.`
                : activeFilter === 'starred'
                ? 'No starred trees yet. Click the star icon on any card to pin it here.'
                : 'Get started by creating a new behavior tree or opening an XML file.'}
            </p>
            <div className="flex items-center gap-2 mt-4">
              <Button type="button" size="sm" variant="default" onClick={onNewTree}>
                <Plus className="size-3.5 mr-1" />
                New Tree
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onOpenFile}>
                <FolderOpen className="size-3.5 mr-1" />
                Open File
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
