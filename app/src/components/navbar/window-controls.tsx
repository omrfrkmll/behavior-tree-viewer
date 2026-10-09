import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { TauriBridge } from '../../features/tauri/tauri-bridge';

export const WindowControls: React.FC = () => {
  const isTauri = TauriBridge.isTauri();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri) return;

    let mounted = true;
    const checkState = async () => {
      const max = await TauriBridge.isWindowMaximized();
      if (mounted) setIsMaximized(max);
    };

    checkState();
    const interval = setInterval(checkState, 500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isTauri]);

  if (!isTauri) return null;

  return (
    <div className="flex items-center h-full ml-2 pl-2 border-l border-border/60 gap-0.5 select-none -mr-1">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => TauriBridge.minimizeWindow()}
        title="Minimize"
        className="h-7 w-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 active:bg-muted transition-colors"
      >
        <Minus className="size-3.5" />
      </button>

      <button
        type="button"
        tabIndex={-1}
        onClick={async () => {
          await TauriBridge.toggleMaximizeWindow();
          const max = await TauriBridge.isWindowMaximized();
          setIsMaximized(max);
        }}
        title={isMaximized ? 'Restore' : 'Maximize'}
        className="h-7 w-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 active:bg-muted transition-colors"
      >
        {isMaximized ? (
          <Copy className="size-3 rotate-180" />
        ) : (
          <Square className="size-3" />
        )}
      </button>

      <button
        type="button"
        tabIndex={-1}
        onClick={() => TauriBridge.closeWindow()}
        title="Close"
        className="h-7 w-7 flex items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive hover:text-destructive-foreground active:bg-destructive/90 transition-colors"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
};
