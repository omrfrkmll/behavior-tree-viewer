import { INITIAL_DEMO_XML } from '../../constants/data';
import { REACTIVE_PATROL_XML, PARALLEL_DIAGNOSTICS_XML } from '../../constants/templates';

export interface RecentFileItem {
  id: string;
  name: string;
  filePath?: string;
  lastOpened: number;
  starred: boolean;
  nodeCount?: number;
  xmlContent: string;
  description?: string;
  badge?: string;
}

type RecentChangeListener = () => void;

const STORAGE_KEY = 'bt_recent_projects_v2';

export class RecentFilesService {
  private static items: RecentFileItem[] = [];
  private static listeners: Set<RecentChangeListener> = new Set();
  private static initialized = false;

  public static init() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.items = JSON.parse(raw);
      } else {
        // Initial seed with high quality presets
        this.items = [
          {
            id: 'seed-default-demo',
            name: 'AutonomousWarehouseMission.xml',
            description: 'Default BT.CPP v4 autonomous warehouse mission and navigation pipeline.',
            badge: 'Default Demo',
            nodeCount: 28,
            starred: true,
            lastOpened: Date.now() - 1000 * 60 * 15, // 15 mins ago
            xmlContent: INITIAL_DEMO_XML.trim()
          },
          {
            id: 'seed-reactive-patrol',
            name: 'ReactivePatrolMission.xml',
            description: 'Reactive safety and battery monitored patrol robot behavior tree.',
            badge: 'Robotics',
            nodeCount: 12,
            starred: true,
            lastOpened: Date.now() - 1000 * 60 * 60 * 3, // 3 hours ago
            xmlContent: REACTIVE_PATROL_XML
          },
          {
            id: 'seed-diagnostics',
            name: 'DiagnosticsSupervisor.xml',
            description: 'Concurrent Lidar, RGB-D camera and IMU telemetry diagnostics architecture.',
            badge: 'Diagnostics',
            nodeCount: 8,
            starred: false,
            lastOpened: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
            xmlContent: PARALLEL_DIAGNOSTICS_XML
          }
        ];
        this.persist();
      }
    } catch (e) {
      console.error('Failed to parse recent files from storage', e);
      this.items = [];
    }
  }

  public static getRecents(): RecentFileItem[] {
    this.init();
    return [...this.items].sort((a, b) => b.lastOpened - a.lastOpened);
  }

  public static getStarred(): RecentFileItem[] {
    return this.getRecents().filter(item => item.starred);
  }

  public static addRecent(item: {
    name: string;
    filePath?: string;
    xmlContent: string;
    nodeCount?: number;
    description?: string;
    badge?: string;
  }): RecentFileItem {
    this.init();

    // Check if an entry with identical name or path already exists
    const existingIndex = this.items.findIndex(
      i => (item.filePath && i.filePath === item.filePath) || i.name === item.name
    );

    let starred = false;
    let targetId = crypto.randomUUID();

    if (existingIndex !== -1) {
      starred = this.items[existingIndex].starred;
      targetId = this.items[existingIndex].id;
      this.items.splice(existingIndex, 1);
    }

    const newItem: RecentFileItem = {
      id: targetId,
      name: item.name,
      filePath: item.filePath,
      lastOpened: Date.now(),
      starred,
      nodeCount: item.nodeCount,
      xmlContent: item.xmlContent,
      description: item.description,
      badge: item.badge
    };

    // Prepend to recents (max 20 items)
    this.items.unshift(newItem);
    if (this.items.length > 20) {
      this.items = this.items.slice(0, 20);
    }

    this.persist();
    this.notify();
    return newItem;
  }

  public static toggleStar(id: string) {
    this.init();
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.starred = !item.starred;
      this.persist();
      this.notify();
    }
  }

  public static removeRecent(id: string) {
    this.init();
    this.items = this.items.filter(i => i.id !== id);
    this.persist();
    this.notify();
  }

  public static clearRecents() {
    this.init();
    this.items = [];
    this.persist();
    this.notify();
  }

  public static subscribe(listener: RecentChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify() {
    this.listeners.forEach(l => {
      try {
        l();
      } catch (err) {
        console.error('Error in recent listener', err);
      }
    });
  }

  private static persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch (e) {
      console.error('Failed to persist recent projects', e);
    }
  }
}
