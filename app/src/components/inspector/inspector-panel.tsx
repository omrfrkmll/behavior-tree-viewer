import React, { useState } from 'react';
import { BtNode, InputTag, NodeModel } from '../../types';
import { getCategoryColor } from '../../utils/category';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2 } from 'lucide-react';

export interface InspectorCallbacks {
  onNodeUpdated: (node: BtNode) => void;
  onNodeDeleted: (node: BtNode) => void;
}

export interface InspectorViewProps {
  selectedNode: BtNode | null;
  customModels: NodeModel[];
  blackboardTags: InputTag[];
  callbacks: InspectorCallbacks;
}

export const InspectorView: React.FC<InspectorViewProps> = ({
  selectedNode,
  customModels,
  blackboardTags,
  callbacks
}) => {
  if (!selectedNode) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground h-full min-h-[220px]">
        <svg
          className="w-6 h-6 opacity-40 text-muted-foreground mb-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
        <span className="text-xs leading-relaxed text-muted-foreground max-w-[180px]">
          Select a node to inspect and configure parameters
        </span>
      </div>
    );
  }

  const n = selectedNode;
  const model = customModels.find(m => m.name === n.name);
  const knownPorts = model?.ports || [];
  const otherAttrs = Object.entries(n.attributes).filter(([k]) => !knownPorts.some(p => p.name === k));

  const [customName, setCustomName] = useState(n.customName || '');
  const [attributes, setAttributes] = useState<Record<string, string>>({ ...n.attributes });
  const [newKey, setNewKey] = useState('');
  const [showAddParam, setShowAddParam] = useState(false);

  const handleNameChange = (val: string) => {
    setCustomName(val);
    n.customName = val;
    callbacks.onNodeUpdated(n);
  };

  const handleAttrChange = (key: string, val: string) => {
    setAttributes(prev => ({ ...prev, [key]: val }));
    n.attributes[key] = val;
    callbacks.onNodeUpdated(n);
  };

  const handleDeleteParam = (key: string) => {
    setAttributes(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    delete n.attributes[key];
    callbacks.onNodeUpdated(n);
  };

  const handleAddParam = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newKey.trim();
    if (trimmed && !(trimmed in attributes)) {
      handleAttrChange(trimmed, '');
      setNewKey('');
      setShowAddParam(false);
    }
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* Node Type */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
          Node Type
        </label>
        <Input
          type="text"
          className="bg-muted/50 font-mono text-muted-foreground cursor-not-allowed select-none"
          value={n.name}
          disabled
        />
        {model?.description && (
          <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">{model.description}</p>
        )}
      </div>

      {/* Instance Name / Alias */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
          Instance Name / Alias
        </label>
        <Input
          type="text"
          value={customName}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. NavigateToTarget"
        />
      </div>

      {/* Parameters & Ports */}
      <div className="pt-2 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">Parameters & Ports</label>
          <span className="text-[10px] font-mono text-muted-foreground">{knownPorts.length} defined</span>
        </div>

        {knownPorts.map(port => {
          const val = attributes[port.name] ?? port.defaultValue ?? '';
          const isInput = !port.direction || port.direction === 'input';

          return (
            <div
              key={port.name}
              className="p-2.5 rounded-md border border-border bg-card text-card-foreground space-y-2 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-foreground truncate max-w-[150px]">
                  {port.name}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border ${
                    isInput
                      ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {port.direction || 'input'}
                </span>
              </div>

              {port.type && (
                <div className="text-[10px] text-muted-foreground font-mono">{port.type}</div>
              )}

              <Input
                type="text"
                value={val}
                onChange={(e) => handleAttrChange(port.name, e.target.value)}
                placeholder={port.defaultValue || 'Enter value or {key}'}
                className="font-mono"
              />

              <div className="flex flex-wrap gap-1 pt-0.5">
                {blackboardTags.map(t => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => handleAttrChange(port.name, t.value)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border cursor-pointer transition-colors"
                  >
                    <span>{t.name}</span>
                  </button>
                ))}
                {port.defaultValue && (
                  <button
                    type="button"
                    onClick={() => handleAttrChange(port.name, port.defaultValue!)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary hover:bg-secondary/80 text-muted-foreground border border-border cursor-pointer transition-colors"
                  >
                    <span>default</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">Custom Attributes</label>
            {!showAddParam && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowAddParam(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3" />
                Add
              </Button>
            )}
          </div>

          {showAddParam && (
            <form onSubmit={handleAddParam} className="flex gap-1.5 items-center p-2 rounded-md border border-border bg-muted/30">
              <Input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="param_name"
                className="flex-1 font-mono text-xs"
                autoFocus
              />
              <Button type="submit" size="xs" variant="default">Add</Button>
              <Button type="button" size="xs" variant="ghost" onClick={() => setShowAddParam(false)}>Cancel</Button>
            </form>
          )}

          {otherAttrs.map(([k]) => (
            <div key={k} className="flex gap-1.5 items-center">
              <Input
                type="text"
                className="w-2/5 bg-muted/40 font-mono text-muted-foreground text-xs"
                value={k}
                disabled
              />
              <Input
                type="text"
                value={attributes[k] ?? ''}
                onChange={(e) => handleAttrChange(k, e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => handleDeleteParam(k)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                title={`Delete ${k}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Node */}
      <div className="pt-3 border-t border-border">
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          onClick={() => {
            if (confirm(`Delete node '${n.name}'?`)) {
              callbacks.onNodeDeleted(n);
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          Delete Node
        </Button>
      </div>
    </div>
  );
};
