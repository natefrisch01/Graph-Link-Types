import { Plugin, WorkspaceLeaf, Notice} from 'obsidian';
import { getAPI } from 'obsidian-dataview';
import * as PIXI from 'pixi.js';

export default class GraphLinkTypesPlugin extends Plugin {
    api = getAPI();
    uniqueKeys = new Set<string>();
    nodeTextMap = new Map(); // Store node-text pairs
    selectedKey: string | null;
    
    

    async onload() {
        if (this.api) {
            // Listen for DataView 'index-ready' event
            this.registerEvent(this.app.metadataCache.on("dataview:index-ready", () => {
                console.log("Dataview index is ready.");
            }));

            // Listen for DataView 'metadata-change' event
            this.registerEvent(this.app.metadataCache.on("dataview:metadata-change",
                (type, file, oldPath) => {
                    console.log(`Metadata changed in file: ${file.path}`);
                }
            ));

        } else {
            console.error("Dataview plugin is not available.");
        }

        this.registerEvent(this.app.workspace.on('layout-change', () => {
            this.getUniqueMetadataKeys();
            this.startUpdateLoop();
        }));

        

        this.addCommand({
            id: 'print-link-type',
            name: 'Print Link Type',
            callback: () =>  this.startUpdateLoop(1)
        });

    }

    getUniqueMetadataKeys() {
        const allPages = this.api.pages('');

        for (const page of allPages) {
            for (const [key, value] of Object.entries(page)) {
                if (this.isLink(value)) {
                    this.uniqueKeys.add(key);
                }
            }
        }
        this.uniqueKeys.delete("file");
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

    findGraphLeaf(): WorkspaceLeaf | null {
        let graphLeaves = this.app.workspace.getLeavesOfType('graph');
		if (graphLeaves.length != 1) {
			return null;
		}
        return graphLeaves[0]
    }

    createTextForLink(renderer, link) {
        const linkString = this.getMetadataKeyForLink(link.source.id, link.target.id);
        if (linkString === null) return;
        const textStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 36,
            fill: 0x00000
        });
        const text = new PIXI.Text(linkString, textStyle);
        text.alpha = 0.7;
        text.anchor.set(0.5, 0.5);
        if (!this.nodeTextMap.has(link)) {
            this.nodeTextMap.set(link, text);
        }
        
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

    destroyMap() {
        if (this.nodeTextMap.size > 0) {
            this.nodeTextMap.forEach((text, link) => {
                if (text !== null) {
                    renderer.px.stage.removeChild(text); // Remove the text from the PIXI container
                    text.destroy();         // Destroy the text object
                }
                this.nodeTextMap.delete(link);
            });
        }
    }
    
    startUpdateLoop(verbosity: number = 0) {
        const graphLeaf = this.findGraphLeaf();
        if (graphLeaf === null) {
            if (verbosity > 0) {
                new Notice("No graph or multiple graphs present.")
            }
            return;
        }
        const renderer = graphLeaf.view.renderer;
        // this.destroyMap();
        const links = renderer.links;
        links.forEach(link => this.createTextForLink(renderer, link));
        requestAnimationFrame(this.updatePositions.bind(this));
    }
    
    updatePositions() {
        const graphLeaf = this.findGraphLeaf();
        if (graphLeaf === null) {
            return;
        }
        const renderer = graphLeaf.view.renderer;
        this.nodeTextMap.forEach((text, link) => {
            this.updateTextPosition(renderer, link);
        });
        requestAnimationFrame(this.updatePositions.bind(this));
    }
    
    getLinkToTextCoordinates(linkX, linkY, panX, panY, scale) {
        return { x: linkX * scale + panX, y: linkY * scale + panY };
    }
}
