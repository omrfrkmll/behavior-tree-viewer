import React, { useState } from 'react';
import { InputTag } from '../../types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tag as TagIcon, Plus, Trash2 } from 'lucide-react';

interface BlackboardViewProps {
  tags: InputTag[];
  onAddTag: (name: string, value: string) => void;
  onDeleteTag: (name: string) => void;
}

export const BlackboardView: React.FC<BlackboardViewProps> = ({
  tags,
  onAddTag,
  onDeleteTag
}) => {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedVal = value.trim() || `{${trimmedName}}`;
    if (trimmedName) {
      onAddTag(trimmedName, trimmedVal);
      setName('');
      setValue('');
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Blackboard Variables</span>
        <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] font-mono font-medium">
          Tags
        </Badge>
      </div>

      <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5">
        <form onSubmit={handleAdd} className="bg-card border border-border rounded-md p-2.5 shadow-xs space-y-2">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            + Create Variable Tag
          </label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tag Name (e.g. goal, speed)"
            className="h-8 text-xs"
          />
          <Input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Default value (e.g. {goal})"
            className="h-8 text-xs"
          />
          <Button type="submit" variant="default" size="sm" className="w-full">
            <Plus className="size-3.5" />
            Add Variable Tag
          </Button>
        </form>

        <div className="space-y-1">
          {tags.map((tag) => (
            <div
              key={tag.name}
              className="flex items-center justify-between p-2 rounded-md border border-border/70 bg-card hover:bg-accent/40 transition-colors shadow-xs group"
            >
              <div className="flex items-center gap-1.5 truncate">
                <TagIcon className="size-3 text-primary shrink-0" />
                <span className="text-xs font-medium text-foreground truncate">{tag.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono truncate">{tag.value}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => onDeleteTag(tag.name)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
