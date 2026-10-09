import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { DiscoveredTreeFile } from '../workspace/workspace-scanner';

export interface WorkspaceScanResult {
  rootDir: string;
  files: DiscoveredTreeFile[];
}

export class TauriBridge {
  public static isTauri(): boolean {
    return (
      typeof window !== 'undefined' &&
      ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
    );
  }

  public static async minimizeWindow(): Promise<void> {
    if (!this.isTauri()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch (e) {
      console.error(e);
    }
  }

  public static async toggleMaximizeWindow(): Promise<void> {
    if (!this.isTauri()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().toggleMaximize();
    } catch (e) {
      console.error(e);
    }
  }

  public static async closeWindow(): Promise<void> {
    if (!this.isTauri()) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch (e) {
      console.error(e);
    }
  }

  public static async isWindowMaximized(): Promise<boolean> {
    if (!this.isTauri()) return false;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      return await getCurrentWindow().isMaximized();
    } catch {
      return false;
    }
  }

  public static async openFileDialog(): Promise<{ path: string; content: string } | null> {
    if (!this.isTauri()) return null;

    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: 'BehaviorTree XML',
            extensions: ['xml']
          }
        ]
      });

      if (!selected || typeof selected !== 'string') return null;

      const content = await invoke<string>('read_text_file', { path: selected });
      return { path: selected, content };
    } catch (err) {
      console.error('Failed to open file via Tauri:', err);
      return null;
    }
  }

  public static async saveFileDialog(content: string, defaultName = 'behavior_tree.xml'): Promise<string | null> {
    if (!this.isTauri()) return null;

    try {
      const selected = await save({
        defaultPath: defaultName,
        filters: [
          {
            name: 'BehaviorTree XML',
            extensions: ['xml']
          }
        ]
      });

      if (!selected) return null;

      await invoke('write_text_file', { path: selected, content });
      return selected;
    } catch (err) {
      console.error('Failed to save file via Tauri:', err);
      return null;
    }
  }

  public static async openWorkspaceDialog(): Promise<WorkspaceScanResult | null> {
    if (!this.isTauri()) return null;

    try {
      const selectedDir = await open({
        directory: true,
        multiple: false
      });

      if (!selectedDir || typeof selectedDir !== 'string') return null;

      const report = await invoke<{
        root_dir: string;
        total_xml_files: number;
        trees: Array<{ file_path: string; tree_id: string; is_main: boolean; node_count: number }>;
      }>('scan_workspace', { path: selectedDir });

      // Collect unique file paths
      const uniquePaths = Array.from(new Set(report.trees.map(t => t.file_path)));
      const files: DiscoveredTreeFile[] = [];

      for (const filePath of uniquePaths) {
        try {
          const content = await invoke<string>('read_text_file', { path: filePath });
          const fileName = filePath.split(/[/\\]/).pop() || 'tree.xml';
          files.push({
            name: fileName,
            xmlContent: content
          });
        } catch (e) {
          console.warn(`Could not read workspace tree file ${filePath}`, e);
        }
      }

      return {
        rootDir: report.root_dir,
        files
      };
    } catch (err) {
      console.error('Failed to scan workspace via Tauri:', err);
      return null;
    }
  }
}
