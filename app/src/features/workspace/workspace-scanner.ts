export interface DiscoveredTreeFile {
  name: string;
  xmlContent: string;
}

export class WorkspaceScannerService {
  public async scanDirectory(dirHandle: any): Promise<DiscoveredTreeFile[]> {
    const results: DiscoveredTreeFile[] = [];

    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.xml')) {
        const file = await entry.getFile();
        const text = await file.text();
        if (text.includes('<BehaviorTree')) {
          results.push({
            name: entry.name,
            xmlContent: text
          });
        }
      }
    }

    return results;
  }
}

export const workspaceScannerService = new WorkspaceScannerService();
