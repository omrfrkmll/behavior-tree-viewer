import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { AppLayout } from './components/layout/app-layout';
import { NavbarView } from './components/navbar/navbar';
import { SidebarTabs } from './ui/tabs';
import { PaletteView } from './components/palette/palette-view';
import { ExplorerView } from './components/explorer/explorer-view';
import { BlackboardView } from './components/blackboard/blackboard-view';
import { InspectorView } from './components/inspector/inspector-panel';
import { CodeDrawerView } from './components/code-drawer/code-drawer-view';
import { CanvasViewerComponent } from './components/canvas/canvas-viewer';
import { ZoomControls } from './components/canvas/zoom-controls';
import { ContextMenuComponent } from './components/context-menu/context-menu';
import { PortPopover } from './ui/popover';
import { ThemeManager } from './ui/theme';
import { xmlService } from './features/xml/xml-service';
import { simulationService } from './features/simulation/simulation-service';
import { workspaceScannerService, DiscoveredTreeFile } from './features/workspace/workspace-scanner';
import { DEFAULT_NODES } from './constants/default-nodes';
import { INITIAL_DEMO_XML, DEFAULT_BLACKBOARD_TAGS } from './constants/data';
import { BehaviorTree, BtNode, InputTag, NodeModel, NodeStatus } from './types';

declare const acquireVsCodeApi: (() => {
  postMessage: (message: any) => void;
  setState: (state: any) => void;
  getState: () => any;
}) | undefined;

export const StudioApp: React.FC = () => {
  const vscodeRef = useRef<ReturnType<NonNullable<typeof acquireVsCodeApi>> | undefined>(
    typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined
  );

  const [trees, setTrees] = useState<BehaviorTree[]>([]);
  const [activeTreeIndex, setActiveTreeIndex] = useState(0);
  const [customModels, setCustomModels] = useState<NodeModel[]>([...DEFAULT_NODES]);
  const [selectedNode, setSelectedNode] = useState<BtNode | null>(null);
  const [blackboardTags, setBlackboardTags] = useState<InputTag[]>(DEFAULT_BLACKBOARD_TAGS);
  const [discoveredFiles, setDiscoveredFiles] = useState<DiscoveredTreeFile[]>([]);
  const [activeTab, setActiveTab] = useState<'palette' | 'explorer' | 'tags'>('palette');
  const [codeViewOpen, setCodeViewOpen] = useState(false);
  const [gridMode, setGridMode] = useState<'dots' | 'lines' | 'empty'>('dots');
  const [copied, setCopied] = useState(false);
  const [xmlVersion, setXmlVersion] = useState(0);
  const [zoomPercent, setZoomPercent] = useState(92);

  const canvasRef = useRef<CanvasViewerComponent | null>(null);
  const popoverRef = useRef<PortPopover | null>(null);
  const contextMenuRef = useRef<ContextMenuComponent | null>(null);

  const treesRef = useRef(trees);
  treesRef.current = trees;
  const activeTreeIndexRef = useRef(activeTreeIndex);
  activeTreeIndexRef.current = activeTreeIndex;
  const customModelsRef = useRef(customModels);
  customModelsRef.current = customModels;
  const blackboardTagsRef = useRef(blackboardTags);
  blackboardTagsRef.current = blackboardTags;
  const selectedNodeRef = useRef(selectedNode);
  selectedNodeRef.current = selectedNode;

  const activeTree = trees[activeTreeIndex] || null;

  const xmlCode = useMemo(() => {
    if (!activeTree) return '<!-- No Tree Available -->';
    return xmlService.serializeTreeToXml(activeTree);
  }, [activeTree, xmlVersion]);

  // Handle tree load
  const loadXml = useCallback((xmlContent: string) => {
    const { trees: parsedTrees, newModels } = xmlService.parseXml(xmlContent, customModelsRef.current);
    if (newModels.length > 0) {
      setCustomModels(prev => [...prev, ...newModels]);
    }

    if (parsedTrees.length > 0) {
      setTrees(parsedTrees);
      setActiveTreeIndex(0);
      setSelectedNode(null);

      setTimeout(() => {
        if (canvasRef.current) {
          canvasRef.current.setData(parsedTrees[0], [...customModelsRef.current, ...newModels]);
          canvasRef.current.setSelectedNode(null);
          canvasRef.current.renderGraph(true);
          canvasRef.current.resetView();
        }
      }, 0);
      setXmlVersion(v => v + 1);
    }
  }, []);

  const handleTreeSelected = useCallback((idx: number) => {
    setActiveTreeIndex(idx);
    setSelectedNode(null);
    const target = treesRef.current[idx];
    if (canvasRef.current && target) {
      canvasRef.current.setData(target, customModelsRef.current);
      canvasRef.current.setSelectedNode(null);
      canvasRef.current.renderGraph(true);
      canvasRef.current.resetView();
    }
    setXmlVersion(v => v + 1);
  }, []);

  const handleDeleteNode = useCallback((node: BtNode) => {
    const currentTree = treesRef.current[activeTreeIndexRef.current];
    if (!currentTree) return;

    if (node.parent) {
      const idx = node.parent.children.indexOf(node);
      if (idx !== -1) {
        node.parent.children.splice(idx, 1);
      }
    } else if (currentTree.floatingNodes) {
      const idx = currentTree.floatingNodes.indexOf(node);
      if (idx !== -1) {
        currentTree.floatingNodes.splice(idx, 1);
      }
    } else if (currentTree.root === node) {
      currentTree.root = undefined;
    }

    setSelectedNode(null);
    canvasRef.current?.setSelectedNode(null);
    canvasRef.current?.renderGraph(false);
    setXmlVersion(v => v + 1);
  }, []);

  const handleDuplicateNode = useCallback((node: BtNode) => {
    const currentTree = treesRef.current[activeTreeIndexRef.current];
    if (!currentTree) return;
    const cloned: BtNode = {
      id: crypto.randomUUID(),
      name: node.name,
      customName: node.customName ? `${node.customName}_copy` : undefined,
      category: node.category,
      attributes: { ...node.attributes },
      children: [],
      status: NodeStatus.IDLE,
      x: (node.x ?? 0) + 40,
      y: (node.y ?? 0) + 40
    };
    if (!currentTree.floatingNodes) currentTree.floatingNodes = [];
    currentTree.floatingNodes.push(cloned);
    setSelectedNode(cloned);
    canvasRef.current?.setSelectedNode(cloned);
    canvasRef.current?.renderGraph(false);
    setXmlVersion(v => v + 1);
  }, []);

  const handleDisconnectLink = useCallback((source: BtNode, target: BtNode) => {
    const currentTree = treesRef.current[activeTreeIndexRef.current];
    if (!currentTree) return;
    const idx = source.children.indexOf(target);
    if (idx !== -1) {
      source.children.splice(idx, 1);
      target.parent = undefined;
      target.parentPort = undefined;
      if (!currentTree.floatingNodes) currentTree.floatingNodes = [];
      if (!currentTree.floatingNodes.includes(target)) {
        currentTree.floatingNodes.push(target);
      }
      canvasRef.current?.renderGraph(false);
      setXmlVersion(v => v + 1);
    }
  }, []);

  const handleAddNodeAtCoords = useCallback((modelName: string, category: string, clientX: number, clientY: number) => {
    const currentTree = treesRef.current[activeTreeIndexRef.current];
    if (!currentTree) return;
    const model = customModelsRef.current.find(m => m.name === modelName);
    const newNode: BtNode = {
      id: crypto.randomUUID(),
      name: modelName,
      category: category as any,
      attributes: {},
      children: [],
      status: NodeStatus.IDLE,
      x: clientX - 300,
      y: clientY - 100
    };
    if (model) {
      model.ports.forEach(p => {
        if (p.defaultValue) newNode.attributes[p.name] = p.defaultValue;
      });
    }
    if (!currentTree.root) {
      currentTree.root = newNode;
    } else {
      if (!currentTree.floatingNodes) currentTree.floatingNodes = [];
      currentTree.floatingNodes.push(newNode);
    }
    setSelectedNode(newNode);
    canvasRef.current?.setSelectedNode(newNode);
    canvasRef.current?.renderGraph(false);
    setXmlVersion(v => v + 1);
  }, []);

  const handleOpenWorkspace = useCallback(async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const treeFiles = await workspaceScannerService.scanDirectory(dirHandle);
        setDiscoveredFiles(treeFiles);
        setActiveTab('explorer');
      } catch (err) {
        console.log('Folder selection dismissed', err);
      }
    } else {
      alert('File System Access API is not supported in this browser. Use btview CLI (`btview serve`) instead!');
    }
  }, []);

  const handleExportXml = useCallback(() => {
    const tree = treesRef.current[activeTreeIndexRef.current];
    if (!tree) return;
    const xml = xmlService.serializeTreeToXml(tree);
    xmlService.downloadXmlFile(xml, `${tree.id}.xml`);
  }, []);

  const handleCopyXml = useCallback(async () => {
    if (!xmlCode) return;
    await navigator.clipboard.writeText(xmlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [xmlCode]);

  const handleAddTag = useCallback((name: string, value: string) => {
    const isBb = value.startsWith('{') && value.endsWith('}');
    setBlackboardTags(prev => {
      const existing = prev.find(t => t.name === name);
      if (existing) {
        return prev.map(t => t.name === name ? { ...t, value, isBlackboard: isBb } : t);
      }
      return [...prev, { name, value, type: 'string', isBlackboard: isBb }];
    });
  }, []);

  const handleDeleteTag = useCallback((name: string) => {
    setBlackboardTags(prev => prev.filter(t => t.name !== name));
  }, []);

  // Post to VS Code when XML updates
  useEffect(() => {
    if (vscodeRef.current && activeTree) {
      vscodeRef.current.postMessage({ type: 'edit', text: xmlCode });
    }
  }, [xmlCode, activeTree]);

  // Mount canvas and services on load
  useEffect(() => {
    ThemeManager.init();

    popoverRef.current = new PortPopover();
    popoverRef.current.setOnBind((node, portName, value) => {
      node.attributes[portName] = value;
      canvasRef.current?.renderGraph(false);
      setXmlVersion(v => v + 1);
    });

    canvasRef.current = new CanvasViewerComponent({
      onNodeSelected: (node) => {
        setSelectedNode(node);
        if (vscodeRef.current && typeof (node as any)?.lineNumber === 'number') {
          vscodeRef.current.postMessage({ type: 'reveal', line: (node as any).lineNumber });
        }
      },
      onTagSelected: (tag) => {
        if (tag) {
          setSelectedNode(null);
        }
      },
      onTreeModified: () => {
        setXmlVersion(v => v + 1);
      },
      onShowPortPopover: (node, portName, anchor) => {
        popoverRef.current?.show(node, portName, anchor, blackboardTagsRef.current);
      },
      onHidePopover: () => {
        popoverRef.current?.hide();
      },
      onZoomChange: (percent) => {
        setZoomPercent(percent);
      }
    });

    contextMenuRef.current = new ContextMenuComponent({
      onDeleteNode: (node) => handleDeleteNode(node),
      onDuplicateNode: (node) => handleDuplicateNode(node),
      onInspectNode: (node) => {
        setSelectedNode(node);
        canvasRef.current?.setSelectedNode(node);
      },
      onDeleteTag: () => {
        canvasRef.current?.deleteSelectedTag();
      },
      onDisconnectTag: () => {
        canvasRef.current?.deleteSelectedTag();
      },
      onDisconnectLink: (source, target) => {
        handleDisconnectLink(source, target);
      },
      onAddNode: (modelName, category, x, y) => {
        handleAddNodeAtCoords(modelName, category, x, y);
      },
      onAutoLayout: () => {
        canvasRef.current?.renderGraph(true);
        canvasRef.current?.resetView();
      },
      onResetView: () => {
        canvasRef.current?.resetView();
      },
      onExportXml: () => {
        handleExportXml();
      }
    });

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((document.activeElement as HTMLElement)?.tagName === 'INPUT') return;
        if (canvasRef.current?.getSelectedTag()) {
          canvasRef.current.deleteSelectedTag();
          return;
        }
        if (selectedNodeRef.current) {
          handleDeleteNode(selectedNodeRef.current);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Initial load: either from VSCode message or demo
    if (vscodeRef.current) {
      const handleMessage = (event: MessageEvent) => {
        const msg = event.data;
        if (msg?.type === 'update' && typeof msg.text === 'string') {
          loadXml(msg.text);
        }
      };
      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('message', handleMessage);
      };
    } else {
      loadXml(INITIAL_DEMO_XML);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [loadXml, handleDeleteNode, handleDuplicateNode, handleDisconnectLink, handleAddNodeAtCoords, handleExportXml]);

  return (
    <AppLayout
      gridMode={gridMode}
      onGridModeChange={(mode) => {
        setGridMode(mode);
        canvasRef.current?.setGridMode(mode);
      }}
      activeTab={activeTab}
      codeViewOpen={codeViewOpen}
      selectedNode={selectedNode}
      navbar={
        <NavbarView
          treeIds={trees.map(t => t.id)}
          activeTreeIndex={activeTreeIndex}
          callbacks={{
            onTreeSelected: handleTreeSelected,
            onOpenFileContent: loadXml,
            onOpenWorkspace: handleOpenWorkspace,
            onExportXml: handleExportXml,
            onToggleCodeView: () => setCodeViewOpen(prev => !prev),
            onAutoLayout: () => {
              canvasRef.current?.renderGraph(true);
              canvasRef.current?.resetView();
            },
            onSimulateStep: () => {
              if (activeTree) {
                simulationService.stepSimulation(activeTree);
                canvasRef.current?.renderGraph(false);
              }
            },
            onResetSimulation: () => {
              if (activeTree) {
                simulationService.resetSimulation(activeTree);
                canvasRef.current?.renderGraph(false);
              }
            }
          }}
        />
      }
      sidebarTabs={
        <SidebarTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          treeCount={discoveredFiles.length}
        />
      }
      palette={<PaletteView models={customModels} />}
      explorer={<ExplorerView files={discoveredFiles} onSelectTreeFile={loadXml} />}
      blackboard={
        <BlackboardView
          tags={blackboardTags}
          onAddTag={handleAddTag}
          onDeleteTag={handleDeleteTag}
        />
      }
      inspector={
        <InspectorView
          key={selectedNode ? selectedNode.id : 'empty'}
          selectedNode={selectedNode}
          customModels={customModels}
          blackboardTags={blackboardTags}
          callbacks={{
            onNodeUpdated: () => {
              canvasRef.current?.renderGraph(false);
              setXmlVersion(v => v + 1);
            },
            onNodeDeleted: (n) => handleDeleteNode(n)
          }}
        />
      }
      codeDrawer={
        <CodeDrawerView
          code={xmlCode}
          selectedNode={selectedNode}
          activeTree={activeTree}
          onClose={() => setCodeViewOpen(false)}
          onCopy={handleCopyXml}
          copied={copied}
        />
      }
      zoomControls={
        <ZoomControls
          zoomPercent={zoomPercent}
          onZoomChange={(percent) => canvasRef.current?.setZoom(percent)}
          onZoomIn={() => canvasRef.current?.zoomIn()}
          onZoomOut={() => canvasRef.current?.zoomOut()}
          onResetZoom={() => canvasRef.current?.resetZoom()}
        />
      }
    />
  );
};

// Entry point
ThemeManager.init();
const renderApp = () => {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    const root = createRoot(rootEl);
    root.render(<StudioApp />);
  }
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}
