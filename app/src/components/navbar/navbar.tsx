import React, { useState, useRef } from 'react';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { ThemeManager } from '../../ui/theme';
import { ThemeCustomizer } from './theme-customizer';
import {
  FolderOpen,
  FolderGit2,
  Download,
  Code2,
  LayoutGrid,
  Play,
  RotateCcw,
  Sun,
  Moon
} from 'lucide-react';

export interface NavbarCallbacks {
  onTreeSelected: (index: number) => void;
  onOpenFileContent: (xmlContent: string) => void;
  onOpenWorkspace: () => void;
  onExportXml: () => void;
  onToggleCodeView: () => void;
  onAutoLayout: () => void;
  onSimulateStep: () => void;
  onResetSimulation: () => void;
}

export interface NavbarViewProps {
  treeIds: string[];
  activeTreeIndex: number;
  callbacks: NavbarCallbacks;
}

export const NavbarView: React.FC<NavbarViewProps> = ({
  treeIds,
  activeTreeIndex,
  callbacks
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDark, setIsDark] = useState(() => ThemeManager.getIsDark());

  const toggleDarkMode = () => {
    const nextDark = ThemeManager.toggleDarkMode();
    setIsDark(nextDark);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        callbacks.onOpenFileContent(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="flex items-center justify-between w-full h-full">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono font-bold text-[11px] shadow-xs">
          BT
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-tight text-foreground leading-none">
            BT Studio
          </span>
          <span className="text-[10px] text-muted-foreground font-medium mt-0.5">ROS 2 & BT.CPP</span>
        </div>
      </div>

      {/* Center Action Toolbar */}
      <div className="flex items-center gap-1.5">
        {/* Tree Selector */}
        {treeIds.length > 0 && (
          <div className="w-[160px]">
            <Select
              value={activeTreeIndex.toString()}
              onValueChange={(val) => callbacks.onTreeSelected(parseInt(val, 10))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select tree..." />
              </SelectTrigger>
              <SelectContent>
                {treeIds.map((id, idx) => (
                  <SelectItem key={id} value={idx.toString()} className="text-xs">
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="h-4 w-px bg-border mx-1" />

        {/* File Operations */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          title="Open BehaviorTree XML file"
        >
          <FolderOpen />
          Open
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          onChange={handleFileChange}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => callbacks.onOpenWorkspace()}
          title="Open Workspace Directory"
        >
          <FolderGit2 />
          Workspace
        </Button>

        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => callbacks.onExportXml()}
          title="Export XML"
        >
          <Download />
          Export
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Realtime Code View Toggle */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => callbacks.onToggleCodeView()}
          title="Toggle Realtime BehaviorTree XML View"
        >
          <Code2 />
          XML Code
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => callbacks.onAutoLayout()}
          title="Auto Align Layout"
        >
          <LayoutGrid />
          Align
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Simulation Buttons */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => callbacks.onSimulateStep()}
          title="Tick Tree Simulation"
        >
          <Play className="fill-current text-emerald-500" />
          Tick
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => callbacks.onResetSimulation()}
          title="Reset Simulation"
        >
          <RotateCcw />
        </Button>
      </div>

      {/* Right Toolbar: Theme Customizer & Dark Mode Toggle */}
      <div className="flex items-center gap-1.5">
        <ThemeCustomizer />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={toggleDarkMode}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun /> : <Moon />}
        </Button>
      </div>
    </div>
  );
};
