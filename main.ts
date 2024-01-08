import { Plugin, App, WorkspaceLeaf, Notice, Modal } from 'obsidian';
import { getAPI } from 'obsidian-dataview';
import * as PIXI from 'pixi.js';

class ColorPickerModal extends Modal {
    keyColorMap: Map<string | null, number>;
    tableBody: HTMLElement;

    constructor(app: App, keyColorMap: Map<string | null, number>) {
        super(app);
        this.keyColorMap = keyColorMap;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.createEl('h2', {text: 'Key Colors'});

        // Add CSS styles
        const styleEl = contentEl.createEl('style', {text: `
            .color-table {
                width: 100%;
                border-collapse: collapse;
            }
            .color-table th, .color-table td {
                border: 1px solid #ccc;
                padding: 8px;
                text-align: left;
            }
            .color-table th {
                background-color: #f2f2f2;
            }
            .color-table tr:hover {
                background-color: #ddd;
            }
            .color-preview {
                width: 50px;
                height: 20px;
                border: 1px solid #ccc;
                cursor: pointer;
            }
            .color-preview-box {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 1px solid #000;
                margin-right: 5px;
                vertical-align: middle;
            }
        `});

        // Create table with styles
        const table = contentEl.createEl('table', {cls: 'color-table'});
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        headerRow.createEl('th', {text: 'Key'});
        headerRow.createEl('th', {text: 'Color'});

        const tbody = table.createEl('tbody');
        this.tableBody = tbody;
        this.refreshTable();
    }

    refreshTable() {
        this.tableBody.empty();
    
        this.keyColorMap.forEach((color, key) => {
            console.log(`Key: ${key}, Color: ${color}`); // Debug log
    
            const row = this.tableBody.createEl('tr');
            row.createEl('td', {text: key});
    
            const colorCell = row.createEl('td');
            const colorString = (typeof color === 'number') ? color.toString(16).padStart(6, '0') : color;
            
            // Ensure color is a hex string and set it as background color
            let colorHex = (typeof color === 'number') ? color.toString(16).padStart(6, '0') : color;
    
            const colorPreviewBox = colorCell.createEl('div', {
                cls: 'color-preview-box',
            });

            colorPreviewBox.style.backgroundColor = `#${colorHex}`;
            
            // Log the computed style of colorPreviewBox
            console.log(colorPreviewBox.style.backgroundColor);
            
    
            const colorText = colorCell.createEl('span', {
                text: `#${colorString}`
            });
    
            colorPreviewBox.addEventListener('click', () => {
                this.openColorPicker(key);
            });
        });
    }
    

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }

    openColorPicker(key: string | null) {
        const colorPickerModal = new Modal(this.app);
        colorPickerModal.titleEl.setText("Select Color");
    
        const colorInput = colorPickerModal.contentEl.createEl('input', {
            type: 'text',
            value: "#ffffff"
        });
    
        const submitButton = colorPickerModal.contentEl.createEl('button', {
            text: 'Apply Color'
        });
    
        submitButton.addEventListener('click', () => {
            const newColor = colorInput.value;
    
            if (newColor && key) {
                const colorInt = parseInt(newColor.replace('#', ''), 16);
                this.keyColorMap.set(key, colorInt);
                this.refreshTable();
                colorPickerModal.close();
            }
        });
    
        colorPickerModal.open();
    }
    

}

export default class UniqueMetadataKeysPlugin extends Plugin {
    api = getAPI();
    keyColorMap = new Map<string | null, number>();
    nodeTextMap = new Map(); // Store node-text pairs
    selectedKey: string | null;
    

    onload() {
        this.addCommand({
            id: 'print-unique-metadata-keys',
            name: 'Print Unique Metadata Keys',
            callback: () => this.printUniqueMetadataKeys()
        });
        this.addCommand({
            id: 'print-link-type',
            name: 'Print Link Type',
            callback: () =>  this.startUpdateLoop()
        });

        this.printUniqueMetadataKeys();

        // Assume these are your keys
        const keys = ['key1', 'key2', 'key3'];

        this.addRibbonIcon('palette', 'Choose Colors', () => {
            new ColorPickerModal(this.app, this.keyColorMap).open();
        });
    }

    printUniqueMetadataKeys() {
        const allPages = this.api.pages('');
        const uniqueKeys = new Set<string>();

        for (const page of allPages) {
            for (const [key, value] of Object.entries(page)) {
                if (this.isLink(value)) {
                    uniqueKeys.add(key);
                }
            }
        }
        uniqueKeys.delete("file");

        // Define a list of categorical colors as single integers
        const colors = [
            16343842, 7260435, 11226103, 8810003, 1997538, 
            11796368, 9731429, 16177103, 15601550, 7601461, 
            1066150, 6197085, 5122908, 1339852, 2975129, 
            1364806, 3203221, 14122353, 7027020, 8280444
        ];

        // Map each unique key to a color
        Array.from(uniqueKeys).forEach((key, index) => {
            const color = colors[index % colors.length]; // Cycle through colors
            this.keyColorMap.set(key, color);
        });

        this.keyColorMap.set(null, 0);
        this.keyColorMap.forEach((color, key) => console.log(`${key}: ${color}`));
    }
    

    getColorForKey(key: string | null): number | undefined{
        return this.keyColorMap.get(key);
    }

    getMetadataKeyForLink(sourceId: string, targetId: string): string | null {
        const sourcePage = this.api.page(sourceId);
        if (!sourcePage) {
            return null;
        }

        for (const [key, value] of Object.entries(sourcePage)) {
            if (this.isLink(value) && value.path === targetId) {
                return key;
            }
        }

        return null;
    }

    isLink(value: any): boolean {
        return typeof value === 'object' && value.hasOwnProperty('path');
    }

    findGraphLeaf(): WorkspaceLeaf | null{
        var t = [];
        this.app.workspace.iterateAllLeaves(function(n) {
            n.view && t.push(n.getDisplayText())
        })
        console.log(t);
        var t = [];
        this.app.workspace.iterateAllLeaves(function(n) {
            n.view && t.push(n)
        })
        console.log(t);
        console.log(this.app.workspace.getLeavesOfType())
        viewType


        let graphLeaves = this.app.workspace.getLeavesOfType('graph');
		if (graphLeaves.length != 1) {
			if (graphLeaves.length < 1) {
				new Notice('No graph view open');
			} else {
				new Notice('More than one graph view open, please choose an active one');
			}
			return null;
		}
        console.log(graphLeaves[0].view.renderer);
        
		return graphLeaves[0]
    }

    createTextForLink(renderer, link) {
        const linkString = this.getMetadataKeyForLink(link.source.id, link.target.id);
        if (linkString === null) return;
        console.log(this.getColorForKey(linkString))
        const textStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 36,
            fill: this.getColorForKey(linkString)
        });
        const text = new PIXI.Text(linkString, textStyle);
        text.alpha = 0.7;
        text.anchor.set(0.5, 0.5);
        this.nodeTextMap.set(link, text);
        this.updateTextPosition(renderer, link);
        renderer.px.stage.addChild(text);
    }
    
    
    updateTextPosition(renderer, link) {
        const text = this.nodeTextMap.get(link);
        if (text) {
            const midX = (link.source.x + link.target.x) / 2;
            const midY = (link.source.y + link.target.y) / 2;
            const { x, y } = this.getLinkToTextCoordinates(midX, midY, renderer.panX, renderer.panY, renderer.scale);
            text.x = x;
            text.y = y;
            text.scale.set(1/(3*renderer.nodeScale));
        }
    }
    
    startUpdateLoop() {
        const graphLeaf = this.findGraphLeaf();
        if (graphLeaf === null) {
            console.log("Graph leaf not found.");
            return;
        }
        const renderer = graphLeaf.view.renderer;
        const links = renderer.links;
        links.forEach(link => this.createTextForLink(renderer, link));
        requestAnimationFrame(this.updatePositions.bind(this));
    }
    
    updatePositions() {
        const graphLeaf = this.findGraphLeaf();
        if (graphLeaf === null) {
            console.log("Graph leaf not found.");
            return;
        }
        const renderer = graphLeaf.view.renderer;
        const links = renderer.links;
        links.forEach(link => {
            this.updateTextPosition(renderer, link);
        });
        requestAnimationFrame(this.updatePositions.bind(this));
    }
    
    getLinkToTextCoordinates(nodeX, nodeY, panX, panY, scale) {
        // Apply scaling - assuming node coordinates are scaled
        let scaledX = nodeX * scale;
        let scaledY = nodeY * scale;
    
        // Apply panning - assuming the entire scene is panned
        let pannedX = scaledX + panX;
        let pannedY = scaledY + panY;
    
        return { x: pannedX, y: pannedY };
    }
    
}
