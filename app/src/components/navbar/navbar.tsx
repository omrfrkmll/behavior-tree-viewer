import React, { useState, useRef, useEffect } from 'react';
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
import { WindowControls } from './window-controls';
import { TauriBridge } from '../../features/tauri/tauri-bridge';
import {
  FolderOpen,
  FolderGit2,
  Download,
  Code2,
  LayoutGrid,
  Play,
  RotateCcw,
  Sun,
  Moon,
  Zap,
  ZapOff,
  Home
} from 'lucide-react';

export interface NavbarCallbacks {
  onTreeSelected: (index: number) => void;
  onOpenFileContent: (xmlContent: string) => void;
  onOpenFile?: () => void;
  onOpenWorkspace: () => void;
  onExportXml: () => void;
  onToggleCodeView: () => void;
  onAutoLayout: () => void;
  onSimulateStep: () => void;
  onResetSimulation: () => void;
  onToggleWelcome?: () => void;
}

export interface NavbarViewProps {
  treeIds: string[];
  activeTreeIndex: number;
  callbacks: NavbarCallbacks;
  isWelcomeScreen?: boolean;
}

export const NavbarView: React.FC<NavbarViewProps> = ({
  treeIds,
  activeTreeIndex,
  callbacks,
  isWelcomeScreen = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDark, setIsDark] = useState(() => ThemeManager.getIsDark());
  const [animationsEnabled, setAnimationsEnabled] = useState(() => ThemeManager.getAnimations());

  useEffect(() => {
    return ThemeManager.subscribe(() => {
      setIsDark(ThemeManager.getIsDark());
      setAnimationsEnabled(ThemeManager.getAnimations());
    });
  }, []);

  const toggleDarkMode = () => {
    const nextDark = ThemeManager.toggleDarkMode();
    setIsDark(nextDark);
  };

  const toggleAnimations = () => {
    const next = ThemeManager.toggleAnimations();
    setAnimationsEnabled(next);
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
    <div
      data-tauri-drag-region
      onDoubleClick={() => {
        if (TauriBridge.isTauri()) {
          TauriBridge.toggleMaximizeWindow();
        }
      }}
      className="flex items-center justify-between w-full h-full select-none"
    >
      {/* Brand & Home */}
      <div className="flex items-center gap-1.5 cursor-default" data-tauri-drag-region>
        <button
          type="button"
          onClick={() => callbacks.onToggleWelcome?.()}
          className="flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-muted/70 transition-colors text-left"
          title="Start Screen"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-mono font-bold text-[11px] shadow-sm select-none">
            BT
          </div>
          <div className="flex flex-col select-none" data-tauri-drag-region>
            <span className="text-xs font-semibold tracking-tight text-foreground leading-none">
              BT Studio
            </span>
            <span className="text-[10px] text-muted-foreground font-medium mt-0.5">ROS 2 & BT.CPP</span>
          </div>
        </button>

        <Button
          type="button"
          variant={isWelcomeScreen ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => callbacks.onToggleWelcome?.()}
          title="Home Dashboard"
          className={`h-7 w-7 ${isWelcomeScreen ? "bg-secondary text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Home className="size-3.5" />
        </Button>
      </div>

      {/* Center Action Toolbar */}
      <div className="flex items-center gap-1.5">
        {/* Tree Selector (editor mode only) */}
        {!isWelcomeScreen && treeIds.length > 0 && (
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

        {!isWelcomeScreen && <div className="h-4 w-px bg-border mx-1" />}

        {/* File Operations */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (callbacks.onOpenFile) {
              callbacks.onOpenFile();
            } else {
              fileInputRef.current?.click();
            }
          }}
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

        {!isWelcomeScreen && (
          <>
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
          </>
        )}
      </div>

      {/* Right Toolbar: Animation Toggle, Theme Customizer & Dark Mode Toggle */}
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={toggleAnimations}
          title={animationsEnabled ? "Disable Canvas Animations" : "Enable Canvas Animations"}
          className={animationsEnabled ? "text-primary hover:text-primary" : "text-muted-foreground opacity-60 hover:opacity-100"}
        >
          {animationsEnabled ? <Zap className="size-4 fill-primary/20 text-primary" /> : <ZapOff className="size-4" />}
        </Button>
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
        <WindowControls />
      </div>
    </div>
  );
};
