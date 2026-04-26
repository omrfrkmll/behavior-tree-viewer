import * as d3 from 'd3';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import * as sax from 'sax';
import { getGroupedNodes } from './node-definitions';

// Declare the function provided by VS Code
declare const acquireVsCodeApi: () => {
    getState: () => any;
    setState: (newState: any) => void;
    postMessage: (message: any) => void;
};

export enum NodeStatus {
    IDLE = 'IDLE',
    RUNNING = 'RUNNING',
    SUCCESS = 'SUCCESS',
    FAILURE = 'FAILURE',
    SKIPPED = 'SKIPPED',
}

interface Node {
    id: string; // Unique ID for D3
    name: string;
    customName?: string;
    attributes?: { [key: string]: any };
    children: Node[];
    lineNumber?: number;
    parent?: Node; // Runtime reference
    collapsed?: boolean; // Visual state
    status: NodeStatus;
}

window.addEventListener('DOMContentLoaded', () => {

    const vscode = acquireVsCodeApi();
    const svg = d3.select("svg");
    const container = document.getElementById('tree-svg-container') as HTMLElement;

    if (svg.empty()) {
        return;
    }

    // Dimensions
    let width = container.clientWidth;
    let height = container.clientHeight;

    const zoomG = svg.append("g");
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
        .filter((event) => {
            // Allow middle button (1) or wheel interactions. 
            // Standard click (0) should be ignored by zoom to allow drag/click on background if needed, 
            // but usually we want to pan/zoom with middle mouse as per request.
            return event.button === 1 || event.type === 'wheel';
        })
        .on("zoom", (event) => {
            zoomG.attr("transform", event.transform);
        });
    svg.call(zoomBehavior as any);

    // Initial Zoom Center
    svg.call(zoomBehavior.transform as any, d3.zoomIdentity.translate(width / 2, 50).scale(1));

    document.getElementById('auto-layout-btn')?.addEventListener('click', () => {
        svg.transition().duration(750).call(zoomBehavior.transform as any, d3.zoomIdentity.translate(width / 2, 50).scale(1));
    });

    document.getElementById('start-sim-btn')?.addEventListener('click', () => {
        if (simulator) {
            simulator.start();
        }
    });

    document.getElementById('stop-sim-btn')?.addEventListener('click', () => {
        if (simulator) {
            simulator.stop();
        }
    });

    document.getElementById('step-sim-btn')?.addEventListener('click', () => {
        if (simulator) {
            simulator.step();
        }
    });

    document.getElementById('force-success-btn')?.addEventListener('click', () => {
        if (simulator) {
            simulator.forceResolve(NodeStatus.SUCCESS);
        }
    });

    document.getElementById('force-failure-btn')?.addEventListener('click', () => {
        if (simulator) {
            simulator.forceResolve(NodeStatus.FAILURE);
        }
    });

    document.getElementById('force-running-btn')?.addEventListener('click', () => {
        if (simulator) {
            simulator.forceResolve(NodeStatus.RUNNING);
        }
    });

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "", // No prefix for cleaner handling in preserveOrder
        // preserveOrder: true is CRITICAL for maintaining Sequence order
        preserveOrder: true,
        allowBooleanAttributes: true,
        parseAttributeValue: false // Do not auto-convert "true" to boolean true, keep as string
    });

    const builder = new XMLBuilder({
        format: true,
        ignoreAttributes: false,
        attributeNamePrefix: "",
        suppressEmptyNode: true,
        preserveOrder: true
    });

    // --- MODAL HELPERS ---
    function showModal(title: string, bodyContent: HTMLElement, onOk: () => void, onCancel?: () => void) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const content = document.createElement('div');
        content.className = 'modal-content';
        overlay.appendChild(content);

        const header = document.createElement('div');
        header.className = 'modal-header';
        header.textContent = title;
        content.appendChild(header);

        const body = document.createElement('div');
        body.className = 'modal-body';
        body.appendChild(bodyContent);
        content.appendChild(body);

        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        content.appendChild(footer);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn';
        cancelBtn.style.backgroundColor = '#444';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
            if (onCancel) onCancel();
        };
        footer.appendChild(cancelBtn);

        const okBtn = document.createElement('button');
        okBtn.className = 'btn';
        okBtn.textContent = 'OK';
        okBtn.onclick = () => {
            document.body.removeChild(overlay);
            onOk();
        };
        footer.appendChild(okBtn);

        document.body.appendChild(overlay);

        // Focus first input
        const firstInput = body.querySelector('input, select') as HTMLElement;
        if (firstInput) {
            firstInput.focus();
        }
    }

    function showPrompt(title: string, label: string, onOk: (value: string) => void) {
        const container = document.createElement('div');
        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.style.display = 'block';
        lbl.style.marginBottom = '5px';
        container.appendChild(lbl);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'modal-input';

        // Handle Enter key
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // We need to trigger the OK action. 
                // Since showModal creates buttons dynamically, we rely on the user clicking OK or we need a way to reference it.
                // Simplified: just call onOk and remove overlay? 
                // Because showModal scope is closed, we can't close it easily from here without hack.
                // Let's just let the user click OK or Tab -> Enter.
            }
        };

        container.appendChild(input);

        showModal(title, container, () => {
            const val = input.value.trim();
            if (val) {
                onOk(val);
            }
        });
    }

    function showConfirm(title: string, message: string, onOk: () => void) {
        const container = document.createElement('div');
        container.textContent = message;
        showModal(title, container, onOk);
    }

    // --- CUSTOM NODE LOGIC ---
    // In a real app we might persist this via vscode.setState or a file.
    let customNodes: { name: string, type: string }[] = [];

    // --- PALETTE LOGIC ---
    function renderPalette() {
        const paletteContent = document.getElementById('palette-content');
        if (!paletteContent) {
            return;
        }
        paletteContent.innerHTML = ''; // Clear existing

        // Add "New Custom Node" Button
        const newBtn = document.createElement('button');
        newBtn.className = 'btn';
        newBtn.style.width = '100%';
        newBtn.style.marginBottom = '10px';
        newBtn.textContent = '+ Custom Node';
        newBtn.onclick = () => {
            const container = document.createElement('div');

            const nameLabel = document.createElement('label');
            nameLabel.textContent = "Node Name";
            container.appendChild(nameLabel);

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'modal-input';
            nameInput.placeholder = "MyCustomAction";
            container.appendChild(nameInput);

            const typeLabel = document.createElement('label');
            typeLabel.textContent = "Node Type";
            typeLabel.style.display = 'block';
            typeLabel.style.marginTop = '10px';
            container.appendChild(typeLabel);

            const typeSelect = document.createElement('select');
            typeSelect.className = 'modal-select';
            ['Action', 'Condition', 'Control', 'Decorator'].forEach(t => {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                typeSelect.appendChild(opt);
            });
            container.appendChild(typeSelect);

            showModal("Create Custom Node", container, () => {
                const name = nameInput.value.trim();
                if (name) {
                    customNodes.push({ name: name, type: typeSelect.value });
                    renderPalette(); // Refresh
                }
            });
        };
        paletteContent.appendChild(newBtn);

        const groups = getGroupedNodes();

        // Merge custom nodes into groups
        customNodes.forEach(cn => {
            if (!groups[cn.type]) {
                groups[cn.type] = [];
            }
            groups[cn.type].push({ name: cn.name, type: cn.type as any, attributes: {} });
        });

        Object.keys(groups).forEach(type => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'palette-group';

            const title = document.createElement('div');
            title.className = 'palette-group-title';
            title.textContent = type;
            groupDiv.appendChild(title);

            groups[type].forEach(nodeDef => {
                const item = document.createElement('div');
                item.className = 'palette-item';
                item.draggable = true;

                const icon = document.createElement('div');
                item.appendChild(icon);
                item.appendChild(document.createTextNode(nodeDef.name));

                // Set color
                icon.className = 'palette-item-icon';
                icon.style.backgroundColor = getNodeColor(nodeDef.type);

                // Drag Data
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer?.setData('application/json', JSON.stringify(nodeDef));
                    e.dataTransfer!.effectAllowed = 'copy';
                });

                groupDiv.appendChild(item);
            });

            paletteContent.appendChild(groupDiv);
        });
    }

    function getNodeColor(type: string): string {
        switch (type) {
            case 'Control': return '#5c2d91'; // purple
            case 'Decorator': return '#0078d4'; // blue
            case 'Action': return '#107c10'; // green
            case 'Condition': return '#d13438'; // red
            default: return '#888';
        }
    }

    renderPalette();


    // --- PROPERTIES PANEL LOGIC ---
    let selectedNode: Node | null = null;

    function renderProperties(node: Node | null) {
        const content = document.getElementById('properties-content');
        if (!content) {
            return;
        }
        content.innerHTML = '';

        if (!node) {
            content.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; margin-top: 20px;">Select a node to edit properties</div>';
            return;
        }

        // Common Fields
        createInput(content, 'Name (Type)', node.name, (val) => { node.name = val; updateGraph(); });
        createInput(content, 'Custom Name / ID', node.customName || '', (val) => { node.customName = val; updateGraph(); });

        // Attributes
        const attrsTitle = document.createElement('div');
        attrsTitle.style.marginTop = '15px';
        attrsTitle.style.marginBottom = '5px';
        attrsTitle.style.fontWeight = 'bold';
        attrsTitle.style.fontSize = '11px';
        attrsTitle.textContent = 'ATTRIBUTES';
        content.appendChild(attrsTitle);

        if (node.attributes) {
            Object.keys(node.attributes).forEach(key => {
                if (key === 'ID' || key === 'name') {
                    return;
                }
                createInput(content, key, node.attributes![key], (val) => {
                    if (node.attributes) {
                        node.attributes[key] = val;
                        updateGraph();
                    }
                });
            });
        }

        // Add New Attribute Button
        const addBtn = document.createElement('button');
        addBtn.className = 'btn';
        addBtn.style.marginTop = '10px';
        addBtn.style.width = '100%';
        addBtn.textContent = '+ Add Attribute';
        addBtn.onclick = () => {
            showPrompt('Add Attribute', 'Attribute Name:', (key) => {
                if (key) {
                    if (!node.attributes) {
                        node.attributes = {};
                    }
                    node.attributes[key] = 'value';
                    renderProperties(node); // Re-render
                    updateGraph();
                }
            });
        };
        content.appendChild(addBtn);

        // Delete Node Button
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger';
        delBtn.style.marginTop = '20px';
        delBtn.style.width = '100%';
        delBtn.textContent = 'Delete Node';
        delBtn.onclick = () => {
            showConfirm('Delete Node', 'Are you sure you want to delete this node and its children?', () => {
                deleteNode(node);
            });
        };
        content.appendChild(delBtn);
    }

    function createInput(parent: HTMLElement, labelText: string, value: string, onChange: (val: string) => void) {
        const group = document.createElement('div');
        group.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = labelText;
        group.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.onchange = (e) => onChange((e.target as HTMLInputElement).value);
        group.appendChild(input);

        parent.appendChild(group);
    }


    // --- LINE NUMBER MAPPING ---
    function computeLineNumbers(xmlText: string): number[] {
        const lines: number[] = [];
        const saxParser = sax.parser(true, { // strict = true
            trim: true,
            normalize: true
        });

        saxParser.onopentag = (node) => {
            // saxParser.line is 0-indexed usually
            lines.push(saxParser.line);
        };

        saxParser.onerror = (e) => {
            // Ignore errors, best effort
        };

        try {
            saxParser.write(xmlText).close();
        } catch (e) {
            console.error("Sax error", e);
        }

        return lines;
    }

    // --- GRAPH LOGIC ---

    // NEW TRANSFORM LOGIC FOR PRESERVE ORDER with LINE NUMBERS
    function transformNode(xmlObj: any, lineNumbersIterator: { next: () => number | undefined }): Node | null {
        // xmlObj is { "TagName": [children], ":@": { attrs } }
        if (!xmlObj) {
            return null;
        }

        const keys = Object.keys(xmlObj);
        if (keys.length === 0) {
            return null;
        }

        // Find tag name
        const tagName = keys.find(k => k !== ':@');
        if (!tagName) {
            return null;
        }

        const attributes = xmlObj[':@'] || {};
        const childrenArray = xmlObj[tagName] || [];

        const customName = attributes.name || attributes.ID;

        // Consume one line number for this tag
        const myLine = lineNumbersIterator.next();

        const node: Node = {
            id: crypto.randomUUID(),
            name: tagName,
            customName: customName,
            attributes: attributes,
            children: [],
            lineNumber: myLine,
            status: NodeStatus.IDLE,
        };

        if (Array.isArray(childrenArray)) {
            for (const childObj of childrenArray) {
                const childNode = transformNode(childObj, lineNumbersIterator);
                if (childNode) {
                    childNode.parent = node;
                    node.children.push(childNode);
                }
            }
        }

        return node;
    }

    // NEW XML SERIALIZATION FOR PRESERVE ORDER
    function nodeToXmlObj(node: Node): any {
        // Attributes
        const attrs = { ...node.attributes };

        // Remove internal attributes
        delete attrs['tree_id'];

        if (node.customName && node.customName !== node.name) {
            if (node.name === 'BehaviorTree' || node.name === 'SubTree') {
                attrs['ID'] = node.customName;
            } else {
                attrs['name'] = node.customName;
            }
        }

        // Ensure values are strings
        Object.keys(attrs).forEach(k => {
            let val = attrs[k];
            if (val === true || val === 'true') {
                val = "true";
            } else if (val === false || val === 'false') {
                val = "false";
            }
            // Don't modify other values
            attrs[k] = val;
        });

        // Children: Map to [{ TagName: [], :@: {} }, ...]
        const childrenXmlArray = node.children.map(child => nodeToXmlObj(child));

        // Result: { TagName: [children], :@: attrs }
        // BUT strict format is: { "TagName": [ ...children... ], ":@": { ... } }
        // Wait, builder with preserveOrder expects ARRAY of OBJECTS.
        // Example: [ { "Sequence": [ { "Action": [], ":@": {} } ], ":@": {} } ]

        const result: any = {};
        result[':@'] = attrs;
        result[node.name] = childrenXmlArray;

        return result;
    }

    // --- STATE ---
    let trees: Node[] = [];
    let activeTreeIndex = 0;
    let simulator: Simulator | null = null;

    // We need to store everything in root that isn't the trees we parsed, 
    // BUT since we parse EVERYTHING as trees (including root attributes), 
    // we need to handle the root wrapper carefully.

    // With preserveOrder, the root is likely [ { "root": [ ...children... ], ":@": ... } ]
    let rootAttributes: any = {};
    let lastJsonObj: any = null;

    // --- UI ELEMENTS ---
    const treeSelect = document.createElement('select');
    treeSelect.style.marginRight = '10px';
    treeSelect.style.backgroundColor = '#3c3c3c';
    treeSelect.style.color = '#ccc';
    treeSelect.style.border = '1px solid #333';
    treeSelect.style.padding = '2px 5px';
    treeSelect.onchange = (e) => {
        activeTreeIndex = parseInt((e.target as HTMLSelectElement).value);
        selectedNode = null;
        renderProperties(null);
        if (trees.length > 0) {
            simulator = new Simulator(trees, activeTreeIndex, updateGraph);
            renderGraph(trees[activeTreeIndex]);
        }
    };

    // Insert Select into Toolbar
    const toolbar = document.getElementById('tree-toolbar');
    if (toolbar) {
        toolbar.insertBefore(treeSelect, toolbar.firstChild);
    }

    // Status Indicator
    const statusEl = document.createElement('div');
    statusEl.style.position = 'absolute';
    statusEl.style.bottom = '10px';
    statusEl.style.right = '10px';
    statusEl.style.padding = '5px 10px';
    statusEl.style.borderRadius = '4px';
    statusEl.style.fontSize = '12px';
    statusEl.style.fontFamily = 'sans-serif';
    statusEl.style.pointerEvents = 'none';
    statusEl.style.display = 'none';
    document.body.appendChild(statusEl);

    function showStatus(msg: string, isError: boolean) {
        statusEl.textContent = msg;
        statusEl.style.display = 'block';
        statusEl.style.backgroundColor = isError ? '#a1260d' : '#107c10';
        statusEl.style.color = 'white';
        if (!isError) {
            setTimeout(() => statusEl.style.display = 'none', 2000);
        }
    }

    // Parse incoming text
    function loadFromText(text: string) {
        try {
            lastJsonObj = parser.parse(text);

            // Expected structure with preserveOrder: 
            // [ { "root": [ { "BehaviorTree": [...] }, ... ], ":@": { ... } } ]

            if (!lastJsonObj || !lastJsonObj[0]) {
                showStatus('Invalid XML', true);
                return;
            }
            showStatus('Synced', false);

            // Compute Line Numbers
            const lineNumbers = computeLineNumbers(text);
            let lineIdx = 0;
            const lineIterator = {
                next: () => {
                    return (lineIdx < lineNumbers.length) ? lineNumbers[lineIdx++] : undefined;
                }
            };

            // Sync logic: SAX finds <root> first. Our loop below processes children of <root>.
            // So we must consume <root> from iterator first.
            if (lineNumbers.length > 0) {
                lineIterator.next(); // Consume <root>
            }


            const rootObj = lastJsonObj[0]; // { "root": ... }
            const rootKey = Object.keys(rootObj).find(k => k !== ':@');
            if (!rootKey) {
                return; // Should be "root"
            }

            const rootContent = rootObj[rootKey]; // Array of children
            rootAttributes = rootObj[':@'] || {};

            trees = [];
            treeSelect.innerHTML = '';

            let treeIndex = 0;

            if (Array.isArray(rootContent)) {
                rootContent.forEach((childObj: any) => {
                    const childKey = Object.keys(childObj).find(k => k !== ':@');

                    if (childKey) {
                        // Only BehaviorTree nodes are added to 'trees' list,
                        // but we MUST consume lines for everything (other tags, comments?) to stay in sync.

                        if (childKey === 'BehaviorTree') {
                            const rootNode = transformNode(childObj, lineIterator);
                            if (rootNode) {
                                let treeID = rootNode.attributes!['ID'] || 'BehaviorTree';
                                if (!rootNode.customName) {
                                    rootNode.customName = treeID;
                                }
                                rootNode.attributes!['tree_id'] = treeID; // Persist ID

                                trees.push(rootNode);

                                const option = document.createElement('option');
                                option.value = treeIndex.toString();
                                option.text = treeID;
                                treeSelect.appendChild(option);
                                treeIndex++;
                            }
                        } else {
                            // Recursively consume lines for non-BehaviorTree tags that fast-xml-parser preserveOrder kept
                            consumeLinesRecursive(childObj, lineIterator);
                        }
                    }
                });
            }

            if (activeTreeIndex >= trees.length) {
                activeTreeIndex = 0;
            }
            if (trees.length > 0) {
                treeSelect.value = activeTreeIndex.toString();
            }

            if (trees.length > 0) {
                if (simulator) {
                    simulator.stop();
                }
                simulator = new Simulator(trees, activeTreeIndex, refreshUI);
                renderGraph(trees[activeTreeIndex]);
            } else {
                svg.selectAll("*").remove();
            }

        } catch (e) {
            console.error(e);
            showStatus('Parse Error', true);
        }
    }

    function consumeLinesRecursive(xmlObj: any, iter: { next: () => number | undefined }) {
        const keys = Object.keys(xmlObj);
        const tagName = keys.find(k => k !== ':@');
        if (!tagName) {
            return;
        }

        // Consume this tag's line
        iter.next();

        const children = xmlObj[tagName];
        if (Array.isArray(children)) {
            children.forEach((c: any) => consumeLinesRecursive(c, iter));
        }
    }

    function refreshUI() {
        if (trees.length > 0) {
            renderGraph(trees[activeTreeIndex]);
        }
    }

    function updateGraph() {
        if (trees.length > 0) {
            refreshUI(); // Update UI first

            // Reconstruct the full ordered object for builder
            const rootChildren: any[] = [];
            trees.forEach(treeNode => {
                rootChildren.push(nodeToXmlObj(treeNode));
            });

            const rootObj: any = {};
            rootObj[':@'] = rootAttributes;
            rootObj['root'] = rootChildren;

            const xmlObj = [rootObj];
            const xmlText = builder.build(xmlObj);
            vscode.postMessage({ type: 'edit', text: xmlText });
        }
    }

    // --- UTILS ---

    // Patch transformNode to exclude the internal 'tree_id' from attributes list if present
    // (Actually we add it there, so we should filter it out during nodeToXmlObj)

    function deleteNode(node: Node) {
        if (!node.parent) {
            alert("Cannot delete the root node of a tree.");
            return;
        }
        const index = node.parent.children.indexOf(node);
        if (index > -1) {
            node.parent.children.splice(index, 1);
            selectedNode = null;
            renderProperties(null);
            updateGraph();
        }
    }

    function renderGraph(rootData: Node | null) {
        if (!rootData) {
            return;
        }

        svg.style('display', 'block');
        zoomG.selectAll("*").remove();

        // Pass accessor to children that respects collapsed state AND handles SubTrees
        const root = d3.hierarchy<Node>(rootData, d => {
            if (d.collapsed) {
                return null;
            }

            // If it is a SubTree, we look up the referenced tree
            if (d.name === 'SubTree') {
                const subTreeID = d.attributes ? d.attributes['ID'] : null;
                if (subTreeID) {
                    const referencedTree = trees.find(t => t.attributes && t.attributes['tree_id'] === subTreeID);
                    if (referencedTree) {
                        return referencedTree.children;
                    }
                }
            }

            return d.children;
        });

        // Adjust node size or spacing
        const treeLayout = d3.tree<Node>()
            .nodeSize([180, 100])
            .separation((a, b) => a.parent == b.parent ? 1.1 : 1.2);

        treeLayout(root);

        const contentG = zoomG.append("g");

        // LINKS
        contentG.selectAll('path.link')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d3.linkVertical()
                .x(d => d ? (d as any).x : 0)
                .y(d => d ? (d as any).y : 0) as any
            )
            .style('stroke', d => {
                if (d.target.data.status === NodeStatus.SUCCESS) {
                    return '#28a745';
                }
                if (d.target.data.status === NodeStatus.RUNNING) {
                    return '#ffd700';
                }
                if (d.target.data.status === NodeStatus.FAILURE) {
                    return '#dc3545';
                }
                return (d.source.data.name === 'SubTree') ? '#ff9900' : '#555';
            }) // Highlight status-based link colors
            .style('stroke-dasharray', d => (d.source.data.name === 'SubTree') ? '5,5' : 'none'); // Dashed for virtual links

        // NODES
        const nodes = contentG.selectAll('g.node')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('class', d => {
                let cls = `node ${selectedNode === d.data ? 'selected' : ''}`;
                if (d.data.status === NodeStatus.RUNNING) {
                    cls += ' running';
                }
                return cls;
            })
            .attr('transform', d => `translate(${d.x},${d.y})`);

        // DRAG BEHAVIOR FOR RE-PARENTING
        let dropTargetNode: d3.HierarchyNode<Node> | null = null;
        let dragStartX = 0;
        let dragStartY = 0;
        let isDragging = false;

        const dragBehavior = d3.drag<SVGGElement, d3.HierarchyNode<Node>>()
            .filter(event => event.button === 0) // Only Left Click
            .on("start", function (event, d) {
                if (d.data.name === 'SubTree') {
                    return; // Cannot drag SubTrees for now
                }
                if (!d.parent) {
                    return; // Cannot drag root
                }

                dragStartX = event.x;
                dragStartY = event.y;
                isDragging = false; // Reset

                // Don't set active/opacity yet, wait until moved
            })
            .on("drag", function (event, d) {
                const dx = event.x - dragStartX;
                const dy = event.y - dragStartY;

                // If moved more than threshold, start dragging
                if (!isDragging && (dx * dx + dy * dy) > 25) { // 5px threshold
                    isDragging = true;
                    d3.select(this).raise().classed("active", true).attr("opacity", 0.5);
                }

                if (isDragging) {
                    // Move Ghost
                    d3.select(this).attr("transform", `translate(${event.x},${event.y})`);

                    // Find Target
                    let minDist = 100;
                    let newTarget: d3.HierarchyNode<Node> | null = null;
                    const allNodes = d3.selectAll('g.node').data() as d3.HierarchyNode<Node>[];

                    allNodes.forEach(other => {
                        if (other === d) {
                            return;
                        }
                        if (other.descendants().includes(d)) {
                            return;
                        }

                        const ox = (other as any).x;
                        const oy = (other as any).y;
                        const diffX = ox - event.x;
                        const diffY = oy - event.y;

                        const dist = Math.sqrt(diffX * diffX + diffY * diffY);

                        if (dist < minDist) {
                            minDist = dist;
                            newTarget = other;
                        }
                    });

                    // Update Highlights
                    if (newTarget !== dropTargetNode) {
                        // Reset old
                        if (dropTargetNode) {
                            d3.selectAll('g.node')
                                .filter((n: any) => n === dropTargetNode)
                                .select('rect')
                                .style('stroke', (n: any) => {
                                    if (selectedNode === n.data) { return '#007fd4'; }
                                    if (n.data.name === 'SubTree') { return '#ff9900'; }
                                    return '#555';
                                })
                                .style('stroke-width', (n: any) => {
                                    if (selectedNode === n.data) { return '2.5px'; }
                                    return '1.5px';
                                });
                        }

                        dropTargetNode = newTarget;

                        // Highlight new
                        if (dropTargetNode) {
                            d3.selectAll('g.node')
                                .filter((n: any) => n === dropTargetNode)
                                .select('rect')
                                .style('stroke', '#00e000') // GREEN INDICATOR
                                .style('stroke-width', '4px');
                        }
                    }
                }
            })
            .on("end", function (event, d) {
                if (!isDragging) {
                    return;
                }

                // End Drag
                d3.select(this).classed("active", false).attr("opacity", 1); // RESTORE OPACITY

                if (dropTargetNode) {
                    const oldParent = d.data.parent;
                    if (oldParent) {
                        const idx = oldParent.children.indexOf(d.data);
                        if (idx > -1) oldParent.children.splice(idx, 1);

                        const newParent = (dropTargetNode as any).data;
                        if (!newParent.children) newParent.children = [];
                        newParent.children.push(d.data);
                        d.data.parent = newParent;

                        newParent.collapsed = false;

                        updateGraph();
                        return;
                    }
                }

                // Reset Layout if failed
                renderGraph(trees[activeTreeIndex]);
            });

        nodes.call(dragBehavior as any);

        nodes.call(dragBehavior as any);

        // Click Handler (Restored)
        // We use isDragging flag to prevent click triggering after a drag
        nodes.on('click', (event, d) => {
            if (isDragging || event.defaultPrevented) return;

            event.stopPropagation();
            selectedNode = d.data;
            renderProperties(selectedNode);
            renderGraph(trees[activeTreeIndex]);

            if (selectedNode && typeof selectedNode.lineNumber === 'number') {
                vscode.postMessage({ type: 'reveal', line: selectedNode.lineNumber });
            }
        });

        // Drop Logic
        const dropHandler = nodes
            .on('dragover', function (event, d) {
                event.preventDefault();
                d3.select(this).select('rect').style('stroke', '#ff00ff').style('stroke-width', '3px');
            })
            .on('dragleave', function (event, d) {
                if (selectedNode === d.data) {
                    d3.select(this).select('rect').style('stroke', '#007fd4').style('stroke-width', '2.5px');
                } else {
                    if (d.data.name === 'SubTree') {
                        d3.select(this).select('rect').style('stroke', '#ff9900').style('stroke-width', '2px');
                    } else {
                        d3.select(this).select('rect').style('stroke', '#555').style('stroke-width', '1.5px');
                    }
                }
            })
            .on('drop', (event, d) => {
                event.preventDefault();
                event.stopPropagation();

                // Reset style
                if (selectedNode === d.data) {
                    d3.select(event.currentTarget).select('rect').style('stroke', '#007fd4').style('stroke-width', '2.5px');
                } else {
                    if (d.data.name === 'SubTree') {
                        d3.select(event.currentTarget).select('rect').style('stroke', '#ff9900').style('stroke-width', '2px');
                    } else {
                        d3.select(event.currentTarget).select('rect').style('stroke', '#555').style('stroke-width', '1.5px');
                    }
                }

                // If dropping onto a SubTree, we prevent it or allow it?
                // Usually you don't add children to a SubTree node directly in the caller (it's a ref).
                // But visualization-wise, d.data refers to the caller node.
                if (d.data.name === 'SubTree') {
                    // Maybe show warning "Cannot add children to SubTree reference directly. Edit the SubTree definition."
                    // Or just ignore.
                    return;
                }

                const json = event.dataTransfer.getData('application/json');

                if (json) {
                    try {
                        const def = JSON.parse(json);
                        const newNode: Node = {
                            id: crypto.randomUUID(),
                            name: def.name,
                            attributes: { ...def.attributes },
                            children: [],
                            parent: d.data,
                            status: NodeStatus.IDLE
                        };

                        if (!d.data.children) d.data.children = [];
                        d.data.children.push(newNode);

                        d.data.collapsed = false;

                        updateGraph();
                    } catch (e) {
                        console.error('Drop error:', e);
                    }
                }
            });

        // RECTANGLE
        nodes.append('rect')
            .attr('width', 140)
            .attr('height', 50)
            .attr('x', -70)
            .attr('y', -25)
            .attr('rx', 5)
            .attr('ry', 5)
            .attr('ry', 5)
            .attr('class', d => {
                if (d.data.status === NodeStatus.RUNNING) return 'status-running';
                if (d.data.status === NodeStatus.SUCCESS) return 'status-success';
                if (d.data.status === NodeStatus.FAILURE) return 'status-failure';
                return '';
            })
            .style('fill', d => {
                if (d.data.status === NodeStatus.IDLE) return d.data.name === 'SubTree' ? '#2d2d2d' : '#252526';
                return null; // Fallback to class-based fill
            })
            .style('stroke', d => {
                if (d.data.status !== NodeStatus.IDLE) return null; // Fallback to class-based stroke
                if (selectedNode === d.data) return '#007fd4';
                if (d.data.name === 'SubTree') return '#ff9900';
                return '#555';
            })
            .style('stroke-width', d => {
                if (d.data.status !== NodeStatus.IDLE) return null; // Fallback to class-based stroke-width
                if (selectedNode === d.data) return '2.5px';
                if (d.data.name === 'SubTree') return '2px';
                return '1.5px';
            });

        // TEXT (Name)
        nodes.append('text')
            .attr('dy', -5)
            .attr('text-anchor', 'middle')
            .style('fill', '#eee')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('pointer-events', 'none')
            .text(d => d.data.name);

        // TEXT (Custom Name / ID)
        nodes.append('text')
            .attr('dy', 15)
            .attr('text-anchor', 'middle')
            .style('fill', '#aaa')
            .style('font-size', '10px')
            .style('pointer-events', 'none')
            .text(d => d.data.customName && d.data.customName !== d.data.name ? d.data.customName : '');

        // --- EXPAND/COLLAPSE BUTTON ---
        // Show if node has children OR if it is a SubTree
        const expandableNodes = nodes.filter(d => {
            const hasChildren = d.data.children && d.data.children.length > 0;
            const isSubTree = d.data.name === 'SubTree';
            return hasChildren || isSubTree;
        });

        const toggleG = expandableNodes.append('g')
            .attr('class', 'toggle')
            .attr('transform', 'translate(0, 25)')
            .style('cursor', 'pointer')
            .on('click', (e, d) => {
                e.stopPropagation();
                d.data.collapsed = !d.data.collapsed;

                // If opening a SubTree, ensure we initialize its "virtual" state if needed?
                // No need, hierarchy accessor does lookup.

                renderGraph(trees[activeTreeIndex]);
            });

        toggleG.append('circle')
            .attr('r', 8)
            .style('fill', '#444')
            .style('stroke', '#ccc');

        toggleG.append('text')
            .attr('dy', 3)
            .attr('text-anchor', 'middle')
            .style('fill', '#fff')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('pointer-events', 'none')
            .text(d => d.data.collapsed ? '+' : '-');

    }

    // Click background to deselect
    svg.on('click', () => {
        selectedNode = null;
        renderProperties(null);
        renderGraph(trees[activeTreeIndex]);
    });

    // --- MESSAGING ---
    window.addEventListener('message', (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'update') {
            loadFromText(message.text);
        }
    });

    // Toggle merge (Currently unused in new layout but good to keep)
    // function getMergeState() {
    //     return (document.getElementById('merge-toggle') as HTMLInputElement).checked;
    // }



    window.addEventListener('resize', () => {

        width = container.clientWidth;

        height = container.clientHeight;

        if (trees.length > 0) renderGraph(trees[activeTreeIndex]);

    });

});



class Simulator {
    private allTrees: Node[];
    private treeIndex: number;
    private tickDelay: number = 500; // ms
    private intervalId: number | null = null;
    private updateCallback: () => void;
    private activeNode: Node | null = null;
    private isStepping: boolean = false;
    private pendingResolution: boolean = false;

    constructor(allTrees: Node[], treeIndex: number, updateCallback: () => void) {
        this.allTrees = allTrees;
        this.treeIndex = treeIndex;
        this.updateCallback = updateCallback;
        this.reset();
    }

    private get root(): Node {
        return this.allTrees[this.treeIndex];
    }

    public reset() {
        this.allTrees.forEach(tree => {
            const allNodes = this.getAllNodes(tree);
            allNodes.forEach(n => n.status = NodeStatus.IDLE);
        });
        this.activeNode = null;
        this.isStepping = false;
        this.pendingResolution = false;
        this.updateButtonStates();
        this.updateCallback();
    }

    public start() {
        if (this.intervalId) return;
        if (this.root.status === NodeStatus.SUCCESS || this.root.status === NodeStatus.FAILURE) {
            this.reset();
        }

        const startSimBtn = document.getElementById('start-sim-btn') as HTMLButtonElement;
        const stopSimBtn = document.getElementById('stop-sim-btn') as HTMLButtonElement;
        if (startSimBtn) {
            startSimBtn.style.display = 'none';
        }
        if (stopSimBtn) {
            stopSimBtn.style.display = 'inline-block';
        }

        this.isStepping = false;
        this.intervalId = window.setInterval(() => this.tick(), this.tickDelay);
    }

    public stop() {
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }

        const startSimBtn = document.getElementById('start-sim-btn') as HTMLButtonElement;
        const stopSimBtn = document.getElementById('stop-sim-btn') as HTMLButtonElement;
        if (startSimBtn) {
            startSimBtn.style.display = 'inline-block';
        }
        if (stopSimBtn) {
            stopSimBtn.style.display = 'none';
        }

        this.reset();
    }

    public step() {
        if (this.intervalId) {
            this.stop();
        }
        if (this.root.status === NodeStatus.SUCCESS || this.root.status === NodeStatus.FAILURE) {
            this.reset();
        }
        this.isStepping = true;
        this.tick();
    }

    public forceResolve(status: NodeStatus) {
        if (this.activeNode && this.pendingResolution) {
            this.activeNode.status = status;
            this.pendingResolution = false;
            this.updateButtonStates();
            this.updateCallback();

            // If we were in continuous mode, we might want to resume, 
            // but for now let's let the user hit "Start" or "Step" again 
            // to keep it simple and predictable.
        }
    }

    private tick() {
        if (this.pendingResolution) {
            return;
        }

        if (this.root.status === NodeStatus.SUCCESS || this.root.status === NodeStatus.FAILURE) {
            if (this.intervalId) {
                this.stop();
            }
            return;
        }

        this.tickNode(this.root);
        this.updateButtonStates();
        this.updateCallback();
    }

    private tickNode(node: Node): NodeStatus {
        if (node.status === NodeStatus.SUCCESS || node.status === NodeStatus.FAILURE) {
            return node.status;
        }

        if (node.status === NodeStatus.IDLE) {
            node.status = NodeStatus.RUNNING;
            this.activeNode = node;

            // If it's a leaf node, we might need to pause for manual input in Step mode
            if (this.isLeaf(node)) {
                if (this.isStepping) {
                    this.pendingResolution = true;
                } else {
                    // Leaf nodes will resolve in the NEXT tick in continuous mode
                }
            }
            return NodeStatus.RUNNING;
        }

        if (node.status === NodeStatus.RUNNING) {
            if (this.isLeaf(node)) {
                // Manual or automated resolution
                if (!this.pendingResolution) {
                    // Automated resolution for continuous mode
                    node.status = Math.random() > 0.2 ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
                }
                return node.status;
            }

            if (node.name === 'SubTree') {
                const subTreeID = node.attributes ? node.attributes['ID'] : null;
                if (subTreeID) {
                    const referencedTree = this.allTrees.find(t => t.attributes && t.attributes['tree_id'] === subTreeID);
                    if (referencedTree) {
                        const s = this.tickNode(referencedTree);
                        if (s === NodeStatus.SUCCESS || s === NodeStatus.FAILURE) {
                            node.status = s;
                        }
                        return node.status;
                    }
                }
                node.status = NodeStatus.FAILURE; // SubTree not found
                return NodeStatus.FAILURE;
            }

            if (node.name === 'Sequence') {
                for (const child of node.children) {
                    const s = this.tickNode(child);
                    if (s === NodeStatus.RUNNING) {
                        return NodeStatus.RUNNING;
                    }
                    if (s === NodeStatus.FAILURE) {
                        node.status = NodeStatus.FAILURE;
                        return NodeStatus.FAILURE;
                    }
                }
                node.status = NodeStatus.SUCCESS;
                return NodeStatus.SUCCESS;
            } else if (node.name === 'Fallback') {
                for (const child of node.children) {
                    const s = this.tickNode(child);
                    if (s === NodeStatus.RUNNING) {
                        return NodeStatus.RUNNING;
                    }
                    if (s === NodeStatus.SUCCESS) {
                        node.status = NodeStatus.SUCCESS;
                        return NodeStatus.SUCCESS;
                    }
                }
                node.status = NodeStatus.FAILURE;
                return NodeStatus.FAILURE;
            } else if (node.name === 'RetryUntilSuccessful' || node.name === 'Retry') {
                if (node.children.length === 0) {
                    node.status = NodeStatus.SUCCESS;
                    return NodeStatus.SUCCESS;
                }
                const child = node.children[0];
                const s = this.tickNode(child);
                if (s === NodeStatus.RUNNING) {
                    return NodeStatus.RUNNING;
                }
                if (s === NodeStatus.SUCCESS) {
                    node.status = NodeStatus.SUCCESS;
                    return NodeStatus.SUCCESS;
                }
                if (s === NodeStatus.FAILURE) {
                    // Logic for retry: if we have attempts left (or -1)
                    // For simulation, we'll keep retrying if not finished
                    this.resetNode(child);
                    return NodeStatus.RUNNING;
                }
            } else if (node.name === 'Repeat') {
                if (node.children.length === 0) {
                    node.status = NodeStatus.SUCCESS;
                    return NodeStatus.SUCCESS;
                }
                const child = node.children[0];
                const s = this.tickNode(child);
                if (s === NodeStatus.RUNNING) {
                    return NodeStatus.RUNNING;
                }
                if (s === NodeStatus.FAILURE) {
                    node.status = NodeStatus.FAILURE;
                    return NodeStatus.FAILURE;
                }
                if (s === NodeStatus.SUCCESS) {
                    // In simulation, we'll repeat once and then succeed for brevity,
                    // or just keep repeating if we want to show the cycle.
                    // Let's reset to show it repeating.
                    this.resetNode(child);
                    return NodeStatus.RUNNING;
                }
            } else if (node.name === 'RecoveryNode') {
                if (node.children.length < 2) {
                    // Falls back to simple sequence if missing recovery child
                    for (const child of node.children) {
                        const s = this.tickNode(child);
                        if (s === NodeStatus.RUNNING) { return NodeStatus.RUNNING; }
                        if (s === NodeStatus.FAILURE) {
                            node.status = NodeStatus.FAILURE;
                            return NodeStatus.FAILURE;
                        }
                    }
                    node.status = NodeStatus.SUCCESS;
                    return NodeStatus.SUCCESS;
                }
                const actionChild = node.children[0];
                const recoveryChild = node.children[1];

                if (recoveryChild.status === NodeStatus.IDLE) {
                    const s = this.tickNode(actionChild);
                    if (s === NodeStatus.RUNNING) { return NodeStatus.RUNNING; }
                    if (s === NodeStatus.SUCCESS) {
                        node.status = NodeStatus.SUCCESS;
                        return NodeStatus.SUCCESS;
                    }
                    if (s === NodeStatus.FAILURE) {
                        // Start recovery
                        return this.tickNode(recoveryChild);
                    }
                } else {
                    const s = this.tickNode(recoveryChild);
                    if (s === NodeStatus.RUNNING) { return NodeStatus.RUNNING; }
                    if (s === NodeStatus.SUCCESS) {
                        // Recovery succeeded, retry action
                        this.resetNode(actionChild);
                        this.resetNode(recoveryChild);
                        return NodeStatus.RUNNING;
                    }
                    if (s === NodeStatus.FAILURE) {
                        node.status = NodeStatus.FAILURE;
                        return NodeStatus.FAILURE;
                    }
                }
            } else {
                for (const child of node.children) {
                    const s = this.tickNode(child);
                    if (s === NodeStatus.RUNNING) return NodeStatus.RUNNING;
                }
                node.status = NodeStatus.SUCCESS;
                return NodeStatus.SUCCESS;
            }
        }

        return node.status;
    }

    private isLeaf(node: Node): boolean {
        if (node.name === 'SubTree') return false; // SubTree is virtual container
        return !node.children || node.children.length === 0;
    }

    private updateButtonStates() {
        const successBtn = document.getElementById('force-success-btn') as HTMLButtonElement;
        const failureBtn = document.getElementById('force-failure-btn') as HTMLButtonElement;
        const runningBtn = document.getElementById('force-running-btn') as HTMLButtonElement;

        if (this.pendingResolution && this.activeNode) {
            successBtn.disabled = false;
            failureBtn.disabled = false;
            // Running is only allowed if it's a leaf node that supports it
            // For now, let's allow "Running" for all leaf nodes to signify "Keep running"
            runningBtn.disabled = false;
        } else {
            successBtn.disabled = true;
            failureBtn.disabled = true;
            runningBtn.disabled = true;
        }
    }
    private resetNode(node: Node) {
        node.status = NodeStatus.IDLE;
        if (node.children) {
            node.children.forEach(c => this.resetNode(c));
        }
        // If it's a SubTree, also reset the referenced tree if known
        if (node.name === 'SubTree') {
            const subTreeID = node.attributes ? node.attributes['ID'] : null;
            if (subTreeID) {
                const referencedTree = this.allTrees.find(t => t.attributes && t.attributes['tree_id'] === subTreeID);
                if (referencedTree) {
                    this.resetNode(referencedTree);
                }
            }
        }
    }

    private getAllNodes(node: Node): Node[] {
        let nodes = [node];
        if (node.children) {
            for (const child of node.children) {
                nodes = nodes.concat(this.getAllNodes(child));
            }
        }
        return nodes;
    }
}
