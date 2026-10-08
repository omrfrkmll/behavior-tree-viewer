import React from 'react';
import { DiscoveredTreeFile } from '../../features/workspace/workspace-scanner';
import { Badge } from '../ui/badge';
import { FileCode } from 'lucide-react';

interface ExplorerViewProps {
  files: DiscoveredTreeFile[];
  onSelectTreeFile: (xmlContent: string) => void;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({ files, onSelectTreeFile }) => {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Discovered Trees</span>
        <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] font-mono font-medium">
          {files.length}
        </Badge>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {files.map((file) => (
          <div
            key={file.name}
            onClick={() => onSelectTreeFile(file.xmlContent)}
            className="flex flex-col p-2 rounded-md border border-border/70 bg-card hover:bg-accent hover:border-primary/40 cursor-pointer transition-colors shadow-xs select-none"
          >
            <div className="text-xs font-medium text-foreground truncate">{file.name}</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <FileCode className="size-3 text-muted-foreground" />
              BehaviorTree XML
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
