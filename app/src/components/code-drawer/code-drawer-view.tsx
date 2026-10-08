import React, { useEffect, useRef, useMemo } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Code2, Copy, X, Focus } from 'lucide-react';
import { BehaviorTree, BtNode } from '../../types';

interface CodeDrawerViewProps {
  code: string;
  selectedNode: BtNode | null;
  activeTree: BehaviorTree | null;
  onClose: () => void;
  onCopy: () => void;
  copied: boolean;
}

function findNodeLineIndex(
  code: string,
  selectedNode: BtNode | null,
  activeTree: BehaviorTree | null
): number | null {
  if (!selectedNode || !code) return null;

  const lines = code.split('\n');

  // 1. Match by customName if present
  if (selectedNode.customName) {
    const escapedCustom = selectedNode.customName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(`name=["']${escapedCustom}["']`);
    for (let i = 0; i < lines.length; i++) {
      if (nameRegex.test(lines[i])) {
        return i;
      }
    }
  }

  // 2. Match by unique ID attribute if present
  if (selectedNode.attributes?.ID) {
    const escapedId = selectedNode.attributes.ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const idRegex = new RegExp(`ID=["']${escapedId}["']`);
    for (let i = 0; i < lines.length; i++) {
      if (idRegex.test(lines[i])) {
        return i;
      }
    }
  }

  // 3. Match by DFS occurrence count in tree
  if (activeTree?.root) {
    let targetIndex = -1;
    let currentIndex = 0;

    const dfs = (curr: BtNode) => {
      if (curr.name === selectedNode.name) {
        if (curr === selectedNode || curr.id === selectedNode.id) {
          targetIndex = currentIndex;
        }
        currentIndex++;
      }
      if (curr.children) {
        curr.children.forEach(dfs);
      }
    };
    dfs(activeTree.root);

    if (targetIndex !== -1) {
      const tagRegex = new RegExp(`<${selectedNode.name}(\\s|>|/)`);
      let matchCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (tagRegex.test(lines[i])) {
          if (matchCount === targetIndex) {
            return i;
          }
          matchCount++;
        }
      }
    }
  }

  // 4. Fallback: First tag matching node name
  const fallbackRegex = new RegExp(`<${selectedNode.name}(\\s|>|/)`);
  for (let i = 0; i < lines.length; i++) {
    if (fallbackRegex.test(lines[i])) {
      return i;
    }
  }

  return null;
}

// Lightweight syntax highlighter for XML tokens
function renderXmlLine(text: string) {
  // Comments
  if (text.trim().startsWith('<!--')) {
    return <span className="text-muted-foreground/80 italic">{text}</span>;
  }

  // Regex to tokenize XML tags, attribute names and values
  const parts: React.ReactNode[] = [];
  const tokenRegex = /(<\/?[\w:-]+)|(\s+[\w:-]+(?==))|(=["'][^"']*["'])|(\/?>)|([^<]+)/g;
  let match;
  let lastIndex = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    const [full, tag, attrName, attrVal, closeTag, other] = match;

    if (tag) {
      parts.push(
        <span key={match.index} className="text-sky-600 dark:text-sky-400 font-semibold">
          {tag}
        </span>
      );
    } else if (attrName) {
      parts.push(
        <span key={match.index} className="text-amber-600 dark:text-amber-400">
          {attrName}
        </span>
      );
    } else if (attrVal) {
      parts.push(
        <span key={match.index} className="text-emerald-600 dark:text-emerald-400">
          {attrVal}
        </span>
      );
    } else if (closeTag) {
      parts.push(
        <span key={match.index} className="text-sky-600 dark:text-sky-400 font-semibold">
          {closeTag}
        </span>
      );
    } else if (other) {
      parts.push(<span key={match.index}>{other}</span>);
    }
    lastIndex = match.index + full.length;
  }

  if (parts.length === 0) {
    return text;
  }
  return parts;
}

export const CodeDrawerView: React.FC<CodeDrawerViewProps> = ({
  code,
  selectedNode,
  activeTree,
  onClose,
  onCopy,
  copied
}) => {
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const selectedLineRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => code.split('\n'), [code]);

  const highlightedLineIndex = useMemo(() => {
    return findNodeLineIndex(code, selectedNode, activeTree);
  }, [code, selectedNode, activeTree]);

  // Smooth scroll to highlighted line when selection changes
  useEffect(() => {
    if (highlightedLineIndex !== null && selectedLineRef.current) {
      selectedLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [highlightedLineIndex]);

  return (
    <div className="flex flex-col h-full w-full bg-card overflow-hidden select-none">
      {/* Header */}
      <div className="h-11 px-3 border-b border-border bg-card/95 backdrop-blur-xs flex items-center justify-between flex-shrink-0 select-none z-10">
        <div className="flex items-center gap-2 overflow-hidden">
          <Code2 className="size-4 text-primary shrink-0" />
          <span className="font-semibold text-xs text-foreground truncate">Live BehaviorTree XML</span>
          {selectedNode ? (
            <Badge
              variant="secondary"
              className="gap-1 px-1.5 py-0.5 text-[10px] font-sans font-medium max-w-[140px] truncate border border-primary/30 text-primary bg-primary/10"
              title={`Selected: ${selectedNode.name}`}
            >
              <Focus className="size-3 shrink-0" />
              <span className="truncate">{selectedNode.customName || selectedNode.name}</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-sans font-medium border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
              Live Sync
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onCopy}
            className="gap-1 text-xs font-sans cursor-pointer"
          >
            <Copy className="size-3" />
            {copied ? 'Copied!' : 'Copy XML'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Code Editor Body */}
      <div
        ref={codeContainerRef}
        className="flex-1 overflow-auto bg-muted/20 font-mono text-[11.5px] leading-relaxed text-foreground select-text py-2"
      >
        <div className="min-w-fit">
          {lines.map((line, idx) => {
            const isHighlighted = idx === highlightedLineIndex;
            return (
              <div
                key={idx}
                ref={isHighlighted ? selectedLineRef : undefined}
                className={`flex items-start px-2 py-0.5 transition-colors duration-150 group ${
                  isHighlighted
                    ? 'bg-primary/15 dark:bg-primary/25 border-l-3 border-primary shadow-xs font-medium'
                    : 'hover:bg-muted/40 border-l-3 border-transparent'
                }`}
              >
                {/* Line number gutter */}
                <div className="w-9 shrink-0 text-right pr-3 select-none text-[10.5px] text-muted-foreground/50 font-mono flex items-center justify-end gap-1">
                  {isHighlighted && (
                    <span className="size-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
                  )}
                  <span>{idx + 1}</span>
                </div>

                {/* Line Code Content */}
                <div className="flex-1 whitespace-pre pr-4 font-mono">
                  {renderXmlLine(line)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info Shelf */}
      <div className="h-6 px-3 border-t border-border bg-card/70 flex items-center justify-between text-[10px] text-muted-foreground font-sans flex-shrink-0 select-none">
        <span>{lines.length} lines</span>
        <span>
          {highlightedLineIndex !== null
            ? `Line ${highlightedLineIndex + 1} highlighted`
            : 'Select a node in canvas to highlight'}
        </span>
      </div>
    </div>
  );
};
