import React, { useState, useMemo } from 'react';
import { NodeCategory, NodeModel } from '../../types';
import { getCategoryColor } from '../../utils/category';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Search } from 'lucide-react';

interface PaletteViewProps {
  models: NodeModel[];
}

export const PaletteView: React.FC<PaletteViewProps> = ({ models }) => {
  const [filter, setFilter] = useState('');

  const categories = [
    NodeCategory.Control,
    NodeCategory.Decorator,
    NodeCategory.Action,
    NodeCategory.Condition,
    NodeCategory.SubTree
  ];

  const filteredCategories = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return categories.map((cat) => {
      const items = models.filter(
        (m) => m.category === cat && m.name.toLowerCase().includes(q)
      );
      return { cat, items };
    }).filter((group) => group.items.length > 0);
  }, [models, filter]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-2 border-b border-border">
        <div className="relative flex items-center w-full">
          <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search nodes..."
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {filteredCategories.map(({ cat, items }) => (
          <div key={cat} className="mb-2">
            <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span style={{ color: getCategoryColor(cat) }}>●</span>
                {cat}
              </div>
              <Badge variant="secondary" className="px-1 py-0 text-[10px] font-normal font-mono">
                {items.length}
              </Badge>
            </div>

            {items.map((item) => (
              <div
                key={item.name}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify(item));
                }}
                className="flex items-center justify-between px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground cursor-grab active:cursor-grabbing rounded-sm transition-colors mx-1.5 my-0.5 select-none border border-transparent hover:border-border/60"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getCategoryColor(cat) }}
                  />
                  <span className="truncate">{item.name}</span>
                </div>
                {item.ports.length > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0 ml-1">
                    {item.ports.length}p
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
