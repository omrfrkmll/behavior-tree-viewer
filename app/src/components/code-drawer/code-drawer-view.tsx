import React, { useEffect, useRef, useMemo } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Code2,
  Copy,
  X,
  Focus,
  Edit3,
  Eye,
  Check,
  AlertCircle,
  Wand2,
  RotateCcw
} from 'lucide-react';
import { BehaviorTree, BtNode } from '../../types';
import { xmlService } from '../../features/xml/xml-service';

function findNodeLineIndex(
  code: string,
  selectedNode: BtNode | null,
  activeTree: BehaviorTree | null
): number | null {
  if (!selectedNode || !code) return null;

  const lines = code.split('\n');

  // Check if selectedNode is nested inside an inlined SubTree
  let enclosingSubTree: BtNode | null = null;
  let walker: BtNode | undefined = selectedNode.parent;
  while (walker) {
    if (walker.name === 'SubTree' || walker.category === 'SubTree') {
      enclosingSubTree = walker;
      break;
    }
    walker = walker.parent;
  }

  const subTreeId = enclosingSubTree
    ? (enclosingSubTree.attributes?.ID || enclosingSubTree.attributes?.name || enclosingSubTree.customName)
    : null;

  let scopeStart = 0;
  let scopeEnd = lines.length;

  if (enclosingSubTree && subTreeId) {
    const escapedSubId = subTreeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const treeHeaderRegex = new RegExp(`<BehaviorTree\\s+[^>]*ID=["']${escapedSubId}["']`, 'i');
    let foundSubTree = false;
    for (let i = 0; i < lines.length; i++) {
      if (treeHeaderRegex.test(lines[i])) {
        scopeStart = i;
        foundSubTree = true;
        for (let j = i + 1; j < lines.length; j++) {
          if (/<\/BehaviorTree>/i.test(lines[j])) {
            scopeEnd = j;
            break;
          }
        }
        break;
      }
    }

    // If the SubTree definition block wasn't present as a separate tree, highlight the SubTree node invocation in the main tree
    if (!foundSubTree) {
      const subTreeCallRegex = new RegExp(`<(SubTree|SubTreePlus)\\s+[^>]*ID=["']${escapedSubId}["']`);
      for (let i = 0; i < lines.length; i++) {
        if (subTreeCallRegex.test(lines[i])) {
          return i;
        }
      }
      return null;
    }
  } else if (activeTree?.id) {
    // Narrow down search to activeTree block if multi-tree XML
    const escapedActiveId = activeTree.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const treeHeaderRegex = new RegExp(`<BehaviorTree\\s+[^>]*ID=["']${escapedActiveId}["']`, 'i');
    for (let i = 0; i < lines.length; i++) {
      if (treeHeaderRegex.test(lines[i])) {
        scopeStart = i;
        for (let j = i + 1; j < lines.length; j++) {
          if (/<\/BehaviorTree>/i.test(lines[j])) {
            scopeEnd = j;
            break;
          }
        }
        break;
      }
    }
  }

  // 1. Match by customName or attributes.name
  const targetName = selectedNode.customName || selectedNode.attributes?.name;
  if (targetName) {
    const escapedName = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(`\\bname=["']${escapedName}["']`);
    for (let i = scopeStart; i < scopeEnd; i++) {
      if (nameRegex.test(lines[i])) {
        return i;
      }
    }
  }

  // 2. Match by unique ID attribute if present
  const targetId = selectedNode.attributes?.ID || selectedNode.attributes?.id;
  if (targetId) {
    const escapedId = targetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const idRegex = new RegExp(`\\b(ID|id)=["']${escapedId}["']`);
    for (let i = scopeStart; i < scopeEnd; i++) {
      if (idRegex.test(lines[i])) {
        return i;
      }
    }
  }

  // 3. Match by DFS occurrence count in the current tree
  if (!enclosingSubTree && activeTree?.root) {
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
      for (let i = scopeStart; i < scopeEnd; i++) {
        if (tagRegex.test(lines[i])) {
          if (matchCount === targetIndex) {
            return i;
          }
          matchCount++;
        }
      }
    }
  }

  // 4. Exact tag search within the scoped tree block only
  const tagRegex = new RegExp(`<${selectedNode.name}(\\s|>|/)`);
  for (let i = scopeStart; i < scopeEnd; i++) {
    if (tagRegex.test(lines[i])) {
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

interface CodeDrawerViewProps {
  code: string;
  selectedNode: BtNode | null;
  activeTree: BehaviorTree | null;
  onClose: () => void;
  onCopy: () => void;
  copied: boolean;
  onApplyCode?: (newXml: string) => void;
}

export const CodeDrawerView: React.FC<CodeDrawerViewProps> = ({
  code,
  selectedNode,
  activeTree,
  onClose,
  onCopy,
  copied,
  onApplyCode
}) => {
  const [mode, setMode] = React.useState<'view' | 'edit'>('view');
  const [draftCode, setDraftCode] = React.useState<string>(code);
  const [justApplied, setJustApplied] = React.useState(false);

  const codeContainerRef = useRef<HTMLDivElement>(null);
  const selectedLineRef = useRef<HTMLDivElement>(null);
  const editorGutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft code whenever external code changes (and not dirty in edit mode)
  useEffect(() => {
    if (mode === 'view') {
      setDraftCode(code);
    }
  }, [code, mode]);

  const lines = useMemo(() => code.split('\n'), [code]);
  const draftLines = useMemo(() => draftCode.split('\n'), [draftCode]);

  const highlightedLineIndex = useMemo(() => {
    if (mode !== 'view') return null;
    return findNodeLineIndex(code, selectedNode, activeTree);
  }, [code, selectedNode, activeTree, mode]);

  // Smooth scroll to highlighted line when selection changes in view mode
  useEffect(() => {
    if (mode === 'view' && highlightedLineIndex !== null && selectedLineRef.current) {
      selectedLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [highlightedLineIndex, mode]);

  // Real-time XML Validation in edit mode
  const validation = useMemo(() => {
    if (mode !== 'edit') return { valid: true };
    return xmlService.validateXml(draftCode);
  }, [draftCode, mode]);

  const isDirty = draftCode !== code;

  const handleApply = () => {
    if (!validation.valid || !onApplyCode) return;
    onApplyCode(draftCode);
    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 2000);
  };

  const handleFormat = () => {
    const formatted = xmlService.formatXml(draftCode);
    setDraftCode(formatted);
  };

  const handleDiscard = () => {
    setDraftCode(code);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      setDraftCode(newVal);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }

    // Ctrl+S / Cmd+S applies changes
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleApply();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-card overflow-hidden select-none">
      {/* Header */}
      <div className="h-11 px-3 border-b border-border bg-card/95 backdrop-blur-xs flex items-center justify-between flex-shrink-0 select-none z-10">
        <div className="flex items-center gap-2 overflow-hidden">
          <Code2 className="size-4 text-primary shrink-0" />
          <span className="font-semibold text-xs text-foreground truncate">BehaviorTree XML</span>

          {/* Mode Switcher */}
          <div className="inline-flex items-center rounded-md bg-muted p-0.5 text-muted-foreground text-[10px] font-sans">
            <button
              type="button"
              onClick={() => setMode('view')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                mode === 'view'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="size-3" />
              View
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftCode(code);
                setMode('edit');
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                mode === 'edit'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Edit3 className="size-3" />
              Editor
            </button>
          </div>

          {mode === 'view' && selectedNode ? (
            <Badge
              variant="secondary"
              className="gap-1 px-1.5 py-0.5 text-[10px] font-sans font-medium max-w-[130px] truncate border border-primary/30 text-primary bg-primary/10"
              title={`Selected: ${selectedNode.name}`}
            >
              <Focus className="size-3 shrink-0" />
              <span className="truncate">{selectedNode.customName || selectedNode.name}</span>
            </Badge>
          ) : mode === 'edit' && isDirty ? (
            <span className="size-2 rounded-full bg-amber-500 shrink-0" title="Unsaved changes" />
          ) : null}
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {mode === 'edit' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleFormat}
                title="Format XML indentation"
                className="gap-1 text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer px-2"
              >
                <Wand2 className="size-3" />
                Format
              </Button>
              {isDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleDiscard}
                  title="Revert draft to current tree XML"
                  className="gap-1 text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer px-1.5"
                >
                  <RotateCcw className="size-3" />
                </Button>
              )}
              <Button
                type="button"
                variant={validation.valid ? 'default' : 'outline'}
                size="xs"
                disabled={!validation.valid || (!isDirty && !justApplied)}
                onClick={handleApply}
                className="gap-1 text-xs font-sans cursor-pointer"
              >
                {justApplied ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    Applied
                  </>
                ) : (
                  <>
                    <Check className="size-3" />
                    Apply
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onCopy}
              className="gap-1 text-xs font-sans cursor-pointer"
            >
              <Copy className="size-3" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          )}

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

      {/* Edit Mode Error Banner */}
      {mode === 'edit' && !validation.valid && (
        <div className="px-3 py-1.5 bg-destructive/15 border-b border-destructive/30 text-destructive text-[11px] font-sans flex items-center gap-2 select-text shrink-0 animate-in fade-in duration-100">
          <AlertCircle className="size-3.5 shrink-0" />
          <span className="truncate flex-1 font-mono">
            {validation.line ? `Line ${validation.line}, Col ${validation.col}: ` : ''}
            {validation.error}
          </span>
        </div>
      )}

      {/* Code Body */}
      {mode === 'view' ? (
        /* View Mode (Syntax Highlighting & Line Tracking) */
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
                      ? 'bg-primary/20 dark:bg-primary/30 border-l-4 border-primary text-foreground font-semibold shadow-xs'
                      : 'hover:bg-muted/40 border-l-4 border-transparent'
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
      ) : (
        /* Edit Mode (Interactive Textarea with Synced Line Numbers) */
        <div className="flex-1 flex overflow-hidden bg-muted/20 relative font-mono text-[11.5px] leading-[20px]">
          {/* Editor Line Numbers Gutter */}
          <div
            ref={editorGutterRef}
            className="w-10 shrink-0 text-right pr-3 select-none text-[10.5px] text-muted-foreground/50 font-mono border-r border-border/50 py-2 overflow-hidden bg-muted/10"
          >
            {draftLines.map((_, idx) => (
              <div key={idx} className="h-[20px]">
                {idx + 1}
              </div>
            ))}
          </div>

          {/* Textarea Input */}
          <textarea
            ref={textareaRef}
            value={draftCode}
            onChange={(e) => setDraftCode(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            onScroll={(e) => {
              if (editorGutterRef.current) {
                editorGutterRef.current.scrollTop = e.currentTarget.scrollTop;
              }
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="flex-1 h-full w-full p-2 pl-3 bg-transparent text-foreground font-mono text-[11.5px] leading-[20px] outline-none resize-none whitespace-pre overflow-auto select-text selection:bg-primary/30"
            placeholder="<!-- Paste or type BehaviorTree XML here -->"
          />
        </div>
      )}

      {/* Footer Info Shelf */}
      <div className="h-6 px-3 border-t border-border bg-card/70 flex items-center justify-between text-[10px] text-muted-foreground font-sans flex-shrink-0 select-none">
        <span>{mode === 'view' ? lines.length : draftLines.length} lines</span>
        <span>
          {mode === 'view' ? (
            highlightedLineIndex !== null
              ? `Line ${highlightedLineIndex + 1} highlighted`
              : 'Select a node in canvas to highlight'
          ) : validation.valid ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <Check className="size-3" />
              Valid XML • Ctrl+S to apply
            </span>
          ) : (
            <span className="text-destructive font-medium flex items-center gap-1">
              <AlertCircle className="size-3" />
              XML Syntax Error
            </span>
          )}
        </span>
      </div>
    </div>
  );
};
