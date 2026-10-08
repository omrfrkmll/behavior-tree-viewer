import React from 'react';
import { createRoot } from 'react-dom/client';
import { BtNode, NodeModel, NodeStatus } from '../../types';
import { getCategoryColor } from '../../utils/category';
import {
  Popover,
  PopoverContent,
  PopoverAnchor
} from '../ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem
} from '../ui/command';

interface QuickAddModalProps {
  seq: BtNode;
  triggerRect: DOMRect;
  customModels: NodeModel[];
  onSelect: (newNode: BtNode) => void;
  onClose: () => void;
}

const QuickAddModal: React.FC<QuickAddModalProps> = ({
  seq,
  triggerRect,
  customModels,
  onSelect,
  onClose
}) => {
  const handleChoose = (model: NodeModel) => {
    const newNode: BtNode = {
      id: crypto.randomUUID(),
      name: model.name,
      category: model.category,
      attributes: {},
      children: [],
      status: NodeStatus.IDLE,
      parent: seq
    };
    model.ports.forEach(p => {
      if (p.defaultValue) newNode.attributes[p.name] = p.defaultValue;
    });
    if (!seq.children) seq.children = [];
    seq.children.push(newNode);

    onSelect(newNode);
  };

  const grouped = customModels.reduce((acc, model) => {
    const cat = model.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(model);
    return acc;
  }, {} as Record<string, NodeModel[]>);

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
        className="w-64 p-0 overflow-hidden shadow-md text-popover-foreground border-border bg-popover"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command className="w-full">
          <CommandInput placeholder="Search node to add..." autoFocus />
          <CommandList className="max-h-60">
            <CommandEmpty>No matching nodes</CommandEmpty>
            {Object.entries(grouped).map(([category, models]) => (
              <CommandGroup key={category} heading={category}>
                {models.map(model => (
                  <CommandItem
                    key={model.name}
                    value={`${model.name} ${category}`}
                    onSelect={() => handleChoose(model)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getCategoryColor(model.category) }}
                      />
                      <span className="font-medium truncate text-foreground">
                        {model.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase shrink-0 ml-1.5">
                      {model.category}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export class QuickAddPopover {
  private static rootContainer: HTMLDivElement | null = null;
  private static reactRoot: ReturnType<typeof createRoot> | null = null;

  public static show(
    seq: BtNode,
    anchor: DOMRect | { clientX: number; clientY: number },
    customModels: NodeModel[],
    onNodeAdded: (newNode: BtNode) => void
  ) {
    this.close();

    const container = document.createElement('div');
    container.id = 'quick-add-portal';
    document.body.appendChild(container);
    this.rootContainer = container;

    let triggerRect: DOMRect;
    if ('left' in anchor && 'bottom' in anchor && 'width' in anchor) {
      triggerRect = anchor as DOMRect;
    } else {
      const x = (anchor as any).clientX ?? 100;
      const y = (anchor as any).clientY ?? 100;
      triggerRect = new DOMRect(x, y, 230, 24);
    }

    this.reactRoot = createRoot(container);
    this.reactRoot.render(
      <QuickAddModal
        seq={seq}
        triggerRect={triggerRect}
        customModels={customModels}
        onSelect={(newNode) => {
          this.close();
          onNodeAdded(newNode);
        }}
        onClose={() => this.close()}
      />
    );
  }

  public static close() {
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
    if (this.rootContainer) {
      this.rootContainer.remove();
      this.rootContainer = null;
    }
  }
}
