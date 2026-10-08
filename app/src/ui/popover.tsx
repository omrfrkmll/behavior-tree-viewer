import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BtNode, InputTag } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverAnchor
} from '../components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem
} from '../components/ui/command';
import { Check, Plus } from 'lucide-react';

export interface PopoverBindCallback {
  (node: BtNode, portName: string, value: string): void;
}

interface SelectMenuProps {
  node: BtNode;
  portName: string;
  initialValue: string;
  triggerRect: DOMRect;
  blackboardTags: InputTag[];
  onBind: (val: string) => void;
  onClose: () => void;
}

const SelectMenu: React.FC<SelectMenuProps> = ({
  portName,
  initialValue,
  triggerRect,
  blackboardTags,
  onBind,
  onClose
}) => {
  const [search, setSearch] = useState('');

  const handleSelect = (val: string) => {
    onBind(val);
    onClose();
  };

  const isExactMatch = blackboardTags.some(
    t => t.value.toLowerCase() === search.toLowerCase().trim() || t.name.toLowerCase() === search.toLowerCase().trim()
  );

  return (
    <Popover open={true} onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor asChild>
        <div
          style={{
            position: 'fixed',
            left: `${triggerRect.left}px`,
            top: `${triggerRect.top}px`,
            width: `${triggerRect.width}px`,
            height: `${triggerRect.height}px`,
            pointerEvents: 'none'
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        className="w-64 p-0 overflow-hidden text-popover-foreground shadow-md border-border bg-popover"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">{portName}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">bind port</span>
        </div>

        <Command className="w-full">
          <CommandInput
            placeholder="Search tag or enter value..."
            value={search}
            onValueChange={setSearch}
            autoFocus
          />
          <CommandList className="max-h-56">
            <CommandEmpty className="py-2.5 px-3 text-xs text-muted-foreground">
              {search.trim() ? 'No tags match query' : 'No blackboard tags'}
            </CommandEmpty>

            {search.trim() && !isExactMatch && (
              <CommandGroup heading="Custom Value">
                <CommandItem
                  value={search.trim()}
                  onSelect={() => handleSelect(search.trim())}
                  className="cursor-pointer font-mono"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                  <span className="truncate">Set "{search.trim()}"</span>
                </CommandItem>
              </CommandGroup>
            )}

            {blackboardTags.length > 0 && (
              <CommandGroup heading="Blackboard Tags">
                {blackboardTags.map(tag => {
                  const isSelected = initialValue === tag.value || initialValue === tag.name;
                  return (
                    <CommandItem
                      key={tag.name}
                      value={`${tag.name} ${tag.value}`}
                      onSelect={() => handleSelect(tag.value)}
                      className="cursor-pointer justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="truncate font-medium">{tag.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[80px]">
                          {tag.value}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1.5" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export class PortPopover {
  private static rootContainer: HTMLDivElement | null = null;
  private static reactRoot: ReturnType<typeof createRoot> | null = null;
  private onBindCallback?: PopoverBindCallback;

  constructor() {}

  public setOnBind(callback: PopoverBindCallback) {
    this.onBindCallback = callback;
  }

  public show(
    node: BtNode,
    portName: string,
    anchor: DOMRect | { clientX: number; clientY: number },
    blackboardTags: InputTag[]
  ) {
    this.hide();

    const container = document.createElement('div');
    container.id = 'port-popover-portal';
    document.body.appendChild(container);
    PortPopover.rootContainer = container;

    const currentVal = node.attributes[portName] || '';

    let triggerRect: DOMRect;
    if ('left' in anchor && 'bottom' in anchor && 'width' in anchor) {
      triggerRect = anchor as DOMRect;
    } else {
      const x = (anchor as any).clientX ?? 100;
      const y = (anchor as any).clientY ?? 100;
      triggerRect = new DOMRect(x, y, 100, 20);
    }

    PortPopover.reactRoot = createRoot(container);
    PortPopover.reactRoot.render(
      <SelectMenu
        node={node}
        portName={portName}
        initialValue={currentVal}
        triggerRect={triggerRect}
        blackboardTags={blackboardTags}
        onBind={(val) => {
          if (this.onBindCallback) {
            this.onBindCallback(node, portName, val);
          }
        }}
        onClose={() => this.hide()}
      />
    );
  }

  public hide() {
    if (PortPopover.reactRoot) {
      PortPopover.reactRoot.unmount();
      PortPopover.reactRoot = null;
    }
    if (PortPopover.rootContainer) {
      PortPopover.rootContainer.remove();
      PortPopover.rootContainer = null;
    }
  }
}
