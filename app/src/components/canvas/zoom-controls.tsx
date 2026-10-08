import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Minus, Plus, RotateCcw } from 'lucide-react';

interface ZoomControlsProps {
  zoomPercent: number;
  onZoomChange: (percent: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoomPercent,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}) => {
  const zoomOptions = [25, 50, 75, 100, 125, 150, 200];

  return (
    <div
      id="floating-zoom-controls"
      className="absolute bottom-3 right-3 flex items-center gap-1 bg-card/90 backdrop-blur-md border border-border rounded-lg p-1 shadow-sm z-10 select-none transition-all duration-150 hover:bg-card hover:shadow-md"
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={onZoomOut}
        title="Zoom Out"
      >
        <Minus className="size-3.5" />
      </Button>

      <Select
        value={zoomOptions.includes(zoomPercent) ? String(zoomPercent) : 'custom'}
        onValueChange={(val) => {
          if (val === 'reset') {
            onResetZoom();
          } else {
            const num = Number(val);
            if (!isNaN(num)) {
              onZoomChange(num);
            }
          }
        }}
      >
        <SelectTrigger className="h-7 px-2 text-xs font-sans font-medium min-w-[72px] border-none bg-muted/40 hover:bg-muted/70 shadow-none cursor-pointer focus:ring-0">
          <SelectValue placeholder={`${zoomPercent}%`}>
            {zoomPercent}%
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" className="min-w-[90px] font-sans">
          {zoomOptions.map((opt) => (
            <SelectItem key={opt} value={String(opt)} className="text-xs font-sans font-medium cursor-pointer">
              {opt}%
            </SelectItem>
          ))}
          <SelectItem value="reset" className="text-xs font-sans font-medium text-primary cursor-pointer border-t border-border mt-1">
            Reset (100%)
          </SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={onZoomIn}
        title="Zoom In"
      >
        <Plus className="size-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer ml-0.5"
        onClick={onResetZoom}
        title="Reset Zoom"
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  );
};
