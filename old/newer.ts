import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { getAPI } from 'obsidian-dataview';
import * as PIXI from 'pixi.js';

export default class GraphLinkTypesPlugin extends Plugin {
    api = getAPI();
    linkTextMap = new Map(); // Store link-text pairs

    async onload() {
        if (!this.api) {
            console.error("Dataview plugin is not available.");
            return;
        }

        this.registerEvent(this.app.workspace.on('layout-change', () => {
            this.updateGraph();
        }));

        this.addCommand({
            id: 'print-link-type',
            name: 'Print Link Type',
            callback: () => this.updateGraph()
        });
    }
    
    updateGraph() {
        const graphLeaf = this.findGraphLeaf();
        if (!graphLeaf) {
            new Notice("No graph or multiple graphs present.");
            return;
        }
    
        const renderer = graphLeaf.view.renderer;
    
        // Reset the addedToStage flag for all text objects
        this.linkTextMap.forEach((text, _) => {
            text.addedToStage = false;
        });
    
        this.manageLinks(renderer);
        requestAnimationFrame(() => this.updatePositions(renderer));
    }
    
    

    manageLinks(renderer) {
        const currentLinks = new Set();

        renderer.links.forEach(link => {
            const linkKey = this.generateLinkKey(link);
            currentLinks.add(linkKey);

            if (!this.linkTextMap.has(linkKey)) {
                const linkText = this.createTextForLink(renderer, link);
                this.linkTextMap.set(linkKey, linkText);
                this.addToStageIfNecessary(renderer, linkText);
            }
        });

        // Update or remove links
        this.updateOrRemoveLinks(renderer, currentLinks);
    }

    updateOrRemoveLinks(renderer, currentLinks) {
        this.linkTextMap.forEach((text, linkKey) => {
            this.addToStageIfNecessary(renderer, text);

            // Remove link text if not in current links
            if (!currentLinks.has(linkKey)) {
                this.removeLinkText(renderer, linkKey);
            }
        });
    }

    addToStageIfNecessary(renderer, text) {
        if (!text.addedToStage && renderer) {
            renderer.px.stage.addChild(text);
            text.addedToStage = true;
        } else {
            console.error("PIXI stage is null or undefined.");
        }
    }

    generateLinkKey(link) {
        // Using a combination of source, target, and link data to create a unique key
        return `${link.source.id}-${link.target.id}`;
    }

    createTextForLink(renderer, link) {
        const linkString = this.getMetadataKeyForLink(link.source.id, link.target.id) || 'Unnamed Link';
        const textStyle = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: 36, fill: 0x00000 });
        const text = new PIXI.Text(linkString, textStyle);
        text.alpha = 0.7;
        text.anchor.set(0.5, 0.5);

        // Flag to track if text has been added to the stage
        text.addedToStage = false;

        return text;
    }

    removeLinkText(renderer, linkKey) {
        const text = this.linkTextMap.get(linkKey);
        if (text) {
            if (renderer) {
                renderer.px.stage.removeChild(text);
            }
            text.destroy();
            this.linkTextMap.delete(linkKey);
        }
    }

    updatePositions(renderer) {
        console.log(this.linkTextMap.size);
        const graphLeaf = this.findGraphLeaf();
        if (graphLeaf === null) {
            return;
        }
        renderer = graphLeaf.view.renderer;
        this.linkTextMap.forEach((text, linkKey) => {
            if (!text) {
                return;
            }
            const [sourceId, targetId] = linkKey.split('-');
            const link = renderer.links.find(l => this.generateLinkKey(l) === linkKey);
            
            console.log(`Link Key: ${linkKey}`);
            console.log(`Link Object:`, link);
            
            if (link && link.source && link.target) { // Check for null values here
                const midX = (link.source.x + link.target.x) / 2;
                const midY = (link.source.y + link.target.y) / 2;
                const { x, y } = this.getLinkToTextCoordinates(midX, midY, renderer.panX, renderer.panY, renderer.scale);
                text.x = x;
                text.y = y;
                text.scale.set(1 / (3 * renderer.nodeScale));
            } else {
                return;
            }
        });
    
        // Ensure continuous update of positions
        if (this.findGraphLeaf()) {
            requestAnimationFrame(() => this.updatePositions(renderer));
        }
    }
    
    

    getMetadataKeyForLink(sourceId, targetId) {
        const sourcePage = this.api.page(sourceId);
        if (!sourcePage) return null;
    
        for (const [key, value] of Object.entries(sourcePage)) {
            // Check if the value is a link and matches the targetId
            if (this.isLink(value) && value.path === targetId) {
                return key;
            }
            // Check if the value is an array of links and find a match
            if (Array.isArray(value)) {
                for (const link of value) {
                    if (this.isLink(link) && link.path === targetId) {
                        return key;
                    }
                }
            }
        }
        return null;
    }
    

    isLink(value) {
        return typeof value === 'object' && value.hasOwnProperty('path');
    }

    findGraphLeaf() {
        const graphLeaves = this.app.workspace.getLeavesOfType('graph');
        return graphLeaves.length === 1 ? graphLeaves[0] : null;
    }

    getLinkToTextCoordinates(linkX, linkY, panX, panY, scale) {
        return { x: linkX * scale + panX, y: linkY * scale + panY };
    }
}

