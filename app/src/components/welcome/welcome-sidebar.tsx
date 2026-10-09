import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Plus,
  FolderOpen,
  FolderGit2,
  Clock,
  Star,
  LayoutGrid,
  Sparkles,
  ArrowRight,
  Info
} from 'lucide-react';

export type WelcomeFilterTab = 'all' | 'recent' | 'starred' | 'templates';

export interface WelcomeSidebarProps {
  activeFilter: WelcomeFilterTab;
  onFilterChange: (filter: WelcomeFilterTab) => void;
  onNewTree: () => void;
  onOpenFile: () => void;
  onOpenWorkspace: () => void;
  hasActiveTree: boolean;
  activeTreeName?: string;
  onResumeTree: () => void;
  recentCount: number;
  starredCount: number;
  templateCount: number;
}

export const WelcomeSidebar: React.FC<WelcomeSidebarProps> = ({
  activeFilter,
  onFilterChange,
  onNewTree,
  onOpenFile,
  onOpenWorkspace,
  hasActiveTree,
  activeTreeName,
  onResumeTree,
  recentCount,
  starredCount,
  templateCount
}) => {
  return (
    <div className="flex flex-col h-full w-full justify-between p-3 select-none">
      {/* Top Action Buttons */}
      <div className="flex flex-col gap-4">
        {/* Primary Actions */}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={onNewTree}
            className="w-full justify-start gap-2.5 font-medium shadow-sm transition-all"
          >
            <Plus className="size-4" />
            New Tree
          </Button>

          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onOpenFile}
            className="w-full justify-start gap-2.5 bg-background hover:bg-muted font-normal text-xs"
          >
            <FolderOpen className="size-4 text-muted-foreground" />
            Open File (.xml)
          </Button>

          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onOpenWorkspace}
            className="w-full justify-start gap-2.5 bg-background hover:bg-muted font-normal text-xs"
          >
            <FolderGit2 className="size-4 text-muted-foreground" />
            Open Workspace
          </Button>
        </div>

        {/* Resume Active Tree banner if currently open */}
        {hasActiveTree && (
          <div className="p-2.5 rounded-lg border border-primary/30 bg-primary/5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-foreground">
              <span className="truncate" title={activeTreeName || 'Active Tree'}>
                {activeTreeName || 'Current Tree'}
              </span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                Active
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResumeTree}
              className="w-full justify-between text-xs h-7 bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Return to Canvas
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Section Divider */}
        <div className="h-px bg-border my-1" />

        {/* Navigation Categories */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
            Views
          </span>

          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
              activeFilter === 'all'
                ? 'bg-secondary text-secondary-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutGrid className="size-4" />
              <span>All</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">
              {recentCount + templateCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange('recent')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
              activeFilter === 'recent'
                ? 'bg-secondary text-secondary-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="size-4" />
              <span>Recent</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">{recentCount}</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange('starred')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
              activeFilter === 'starred'
                ? 'bg-secondary text-secondary-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Star className="size-4 text-amber-500 fill-amber-500/20" />
              <span>Starred</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">{starredCount}</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange('templates')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
              activeFilter === 'templates'
                ? 'bg-secondary text-secondary-foreground shadow-2xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-4 text-primary" />
              <span>Templates</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">{templateCount}</span>
          </button>
        </div>
      </div>

      {/* Footer Info Box */}
      <div className="pt-4 border-t border-border flex flex-col gap-2">
        <div className="flex items-start gap-2 p-2 rounded-md bg-muted/40 text-[11px] text-muted-foreground leading-relaxed">
          <Info className="size-3.5 mt-0.5 shrink-0 text-primary" />
          <span>Drag and drop .xml files anywhere on the screen to open directly.</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono px-1">
          <span>BT.CPP v4</span>
          <span>ROS 2 Studio</span>
        </div>
      </div>
    </div>
  );
};
