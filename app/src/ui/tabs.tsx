import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Library, FolderTree, Tag } from 'lucide-react';

export interface SidebarTabsProps {
  activeTab: 'palette' | 'explorer' | 'tags';
  onTabChange: (tab: 'palette' | 'explorer' | 'tags') => void;
  treeCount?: number;
}

export const SidebarTabs: React.FC<SidebarTabsProps> = ({
  activeTab,
  onTabChange,
  treeCount = 0
}) => {
  return (
    <Tabs value={activeTab} onValueChange={(val) => onTabChange(val as any)} className="w-full">
      <TabsList className="grid w-full grid-cols-3 h-9 p-1">
        <TabsTrigger value="palette" className="gap-1.5 text-xs">
          <Library className="h-3.5 w-3.5" />
          Library
        </TabsTrigger>
        <TabsTrigger value="explorer" className="gap-1.5 text-xs">
          <FolderTree className="h-3.5 w-3.5" />
          Trees ({treeCount})
        </TabsTrigger>
        <TabsTrigger value="tags" className="gap-1.5 text-xs">
          <Tag className="h-3.5 w-3.5" />
          Tags
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
