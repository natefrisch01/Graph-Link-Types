import { Plugin, WorkspaceLeaf, Notice} from 'obsidian';
import { getAPI, Page } from 'obsidian-dataview';
import { CustomRenderer, CustomLink, DataviewLinkType} from 'types';
import { LinkManager } from 'linkManager';
import * as PIXI from 'pixi.js';
import extractLinks from 'markdown-link-extractor';

export default class GraphLinkTypesPlugin extends Plugin {
    // Retrieve the Dataview API
    api = getAPI();
    // A map to keep track of the text nodes created for each link
    nodeTextMap: Map<CustomLink, PIXI.Text> = new Map();
    currentRenderer: CustomRenderer | null = null;
    animationFrameId: number | null = null;

    // Lifecycle method called when the plugin is loaded
    async onload(): Promise<void> {
        // Check if the Dataview API is available
        if (!this.api) {
            console.error("Dataview plugin is not available.");
            return;
        }

        // Handle layout changes
        this.registerEvent(this.app.workspace.on('layout-change', () => {
            this.handleLayoutChange();
        }));

        // Add a command to the command palette
        this.addCommand({
            id: 'print-link-type',
            name: 'Print Link Type',
            callback: () => {
                this.toyLinks();
            }
        });
    }

    toyLinks() {
        // Example frames: Each frame is an array of links
        const frames: CustomLink[][] = [
            // Frame 1: Simple links, some will form pairs later
            [
            { source: { id: "A", x: 0, y: 0 }, target: { id: "B", x: 0, y: 0 } },
            { source: { id: "C", x: 0, y: 0 }, target: { id: "D", x: 0, y: 0 } },
            ],
        
            // Frame 2: Adding reverse links to form pairs and keeping existing links
            [
            { source: { id: "A", x: 0, y: 0 }, target: { id: "B", x: 0, y: 0 } }, // Existing link
            { source: { id: "B", x: 0, y: 0 }, target: { id: "A", x: 0, y: 0 } }, // Forms a pair with Frame 1's A-B
            { source: { id: "C", x: 0, y: 0 }, target: { id: "D", x: 0, y: 0 } }, // Existing link
            { source: { id: "E", x: 0, y: 0 }, target: { id: "F", x: 0, y: 0 } }, // New link
            ],
        
            // Frame 3: Keeping a pair, removing a single link, adding a new link
            [
            { source: { id: "A", x: 0, y: 0 }, target: { id: "B", x: 0, y: 0 } }, // Existing link
            { source: { id: "B", x: 0, y: 0 }, target: { id: "A", x: 0, y: 0 } }, // Existing pair
            { source: { id: "G", x: 0, y: 0 }, target: { id: "H", x: 0, y: 0 } }, // New link
            ],
        
            // Frame 4:
            [
            { source: { id: "B", x: 0, y: 0 }, target: { id: "A", x: 0, y: 0 } },
            { source: { id: "G", x: 0, y: 0 }, target: { id: "H", x: 0, y: 0 } }, // New link
            ],
        ];

        const linkManager = new LinkManager();

        frames.forEach((frame, frameIndex) => {
            console.log(`Frame ${frameIndex + 1}:`);

            // Update link manager with the current frame's links
            linkManager.updateLinks(frame);

            // Process links
            frame.forEach(link => {
                const key = linkManager.generateKey(link.source.id, link.target.id);
                if (!linkManager.linksMap.has(key)) {
                    linkManager.addLink(link);
                }
                const status = linkManager.getLinkStatus(key);

                // Print link status
                if (status === 'first') {
                    console.log('first: ' + key);
                } else if (status === 'second') {
                    console.log('second: ' + key);
                } else {
                    console.log(key); // Not part of a pair
                }
            });
        });

    }



    // Find the first valid graph renderer in the workspace
    findRenderer(): CustomRenderer | null {
        let graphLeaves = this.app.workspace.getLeavesOfType('graph');
        for (const leaf of graphLeaves) {
            const renderer = leaf.view.renderer;
            if (this.isCustomRenderer(renderer)) {
                return renderer;
            }
        }

        graphLeaves = this.app.workspace.getLeavesOfType('localgraph');
        for (const leaf of graphLeaves) {
            const renderer = leaf.view.renderer;
            if (this.isCustomRenderer(renderer)) {
                return renderer;
            }
        }
        return null;
    }
    
    async handleLayoutChange() {
        // Cancel the animation frame on layout change
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        await this.waitForRenderer();
        this.checkAndUpdateRenderer();
    }

    checkAndUpdateRenderer() {
        const newRenderer = this.findRenderer();
        if (!newRenderer) {
            this.currentRenderer = null;
            return;
        }
        this.currentRenderer = newRenderer;
        this.startUpdateLoop();
    }

    
    waitForRenderer(): Promise<void> {
        return new Promise((resolve) => {
            const checkInterval = 500; // Interval in milliseconds to check for the renderer

            const intervalId = setInterval(() => {
                const renderer = this.findRenderer();
                if (renderer) {
                    clearInterval(intervalId);
                    resolve();
                }
            }, checkInterval);
        });
    }
	
    // Create or update text for a given link
    createTextForLink(renderer: CustomRenderer, link: CustomLink, reverseString : string | null = null): void {

        // Get the text to display for the link
        let linkString: string | null = this.getMetadataKeyForLink(link.source.id, link.target.id);
        if (linkString === null) return; //doesn't add if link is null
        
        // Mutual pairs, links that both reference each other
        if (link.source.id === link.target.id) {
            linkString = "";
        } else if (reverseString === null) {
            const reverseLink : CustomLink | undefined = renderer.links.find(linkFromLoop => linkFromLoop.source.id === link.target.id && linkFromLoop.target.id === link.source.id);
            
            if (reverseLink) {
                this.createTextForLink(renderer, reverseLink, linkString);
                linkString = "";
            }
        } else {
            linkString = linkString + "\n" + reverseString;
        }

        // If text already exists for this link, remove text
        if (this.nodeTextMap.has(link)) {
            const existingText = this.nodeTextMap.get(link)!;
            renderer.px.stage.removeChild(existingText);
            existingText.destroy();
        }

        // Define the style for the text
        const textStyle: PIXI.TextStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 36,
            fill: this.determineTextColor()
        });
        // Create new text node
        const text: PIXI.Text = new PIXI.Text(linkString, textStyle);
        text.alpha = 0.7;
        text.anchor.set(0.5, 0.5);
        // Add the text node to the map and the renderer
        this.nodeTextMap.set(link, text);

        this.updateTextPosition(renderer, link);
        renderer.px.stage.addChild(text);
    }

    // Update the position of the text on the graph
    updateTextPosition(renderer: CustomRenderer, link: CustomLink): void {
        if (!renderer || !link || !link.source || !link.target) {
            // If any of these are null, exit the function
            return;
        }
 
        const text: PIXI.Text | undefined = this.nodeTextMap.get(link);
        // Calculate the mid-point of the link
        const midX: number = (link.source.x + link.target.x) / 2;
        const midY: number = (link.source.y + link.target.y) / 2;
        // Transform the mid-point coordinates based on the renderer's pan and scale
        const { x, y } = this.getLinkToTextCoordinates(midX, midY, renderer.panX, renderer.panY, renderer.scale);
        if (text && renderer.px && renderer.px.stage && renderer.px.stage.children && renderer.px.stage.children.includes(text)) {
            // Set the position and scale of the text
            text.x = x;
            text.y = y;
            text.scale.set(1 / (3 * renderer.nodeScale));
        }
    }

    // Remove all text nodes from the graph
    destroyMap(renderer: CustomRenderer): void {
        if (this.nodeTextMap.size > 0) {
            this.nodeTextMap.forEach((text, link) => {
                if (text && renderer.px && renderer.px.stage && renderer.px.stage.children && renderer.px.stage.children.includes(text)) {
                    renderer.px.stage.removeChild(text);
                    text.destroy();
                }
                this.nodeTextMap.delete(link);
            });
        }
    }

    // Function to start the update loop for rendering.
    startUpdateLoop(verbosity: number = 0): void {
        if (!this.currentRenderer) {
            if (verbosity > 0) {
                new Notice('No valid graph renderer found.');
            }
            return;
        }
        const renderer : CustomRenderer = this.currentRenderer;
        // Remove existing text from the graph.
        this.destroyMap(renderer);
        // Create text for each link in the graph.
        renderer.links.forEach((link: CustomLink) => this.createTextForLink(renderer, link));
        // Call the function to update positions in the next animation frame.
        requestAnimationFrame(this.updatePositions.bind(this));
    }



    // Function to continuously update the positions of text objects.
    updatePositions(): void {

        // Find the graph renderer in the workspace.
        if (!this.currentRenderer) {
            return;
        }

        let updateMap = false;
        let rendererLinks: Set<CustomLink>;

        if (this.animationFrameId && this.animationFrameId % 20 == 0) {
            updateMap = true;
            rendererLinks = new Set();
        }

        const renderer: CustomRenderer = this.currentRenderer;

        // For each link in the graph, update the position of its text.
        renderer.links.forEach((link: CustomLink) => {
            if (updateMap) {
                // Add text for new links.
                if (!this.nodeTextMap.has(link)) {
                    this.createTextForLink(renderer, link);
                }
                // Add all links to the set of links, so that we can check quickly when removing text.
                rendererLinks.add(link);
            }
            this.updateTextPosition(renderer, link);
        });

        // Remove text that should no longer be on stage.
        if (updateMap) {
            this.nodeTextMap.forEach((text, link : CustomLink) => {
                if (!rendererLinks.has(link)) {
                    if (text && renderer.px && renderer.px.stage && renderer.px.stage.children && renderer.px.stage.children.includes(text)) {
                        renderer.px.stage.removeChild(text);
                        text.destroy();
                    }
                    this.nodeTextMap.delete(link);
                }
            });
        }

        // Continue updating positions in the next animation frame.
        this.animationFrameId = requestAnimationFrame(this.updatePositions.bind(this));
    }

    // Function to calculate the coordinates for placing the link text.
    getLinkToTextCoordinates(linkX: number, linkY: number, panX: number, panY: number, scale: number): { x: number, y: number } {
        // Apply scaling and panning to calculate the actual position.
        return { x: linkX * scale + panX, y: linkY * scale + panY };
    }

    // Method to determine the type of a value, now a class method
    private determineDataviewLinkType(value: any): DataviewLinkType {
        if (typeof value === 'object' && value !== null && 'path' in value) {
            return DataviewLinkType.WikiLink;
        } else if (typeof value === 'string' && value.includes('](')) {
            return DataviewLinkType.MarkdownLink;
        } else if (typeof value === 'string') {
            return DataviewLinkType.String;
        } else if (Array.isArray(value)) {
            return DataviewLinkType.Array;
        } else {
            return DataviewLinkType.Other;
        }
    }

    // Get the metadata key for a link between two pages
    getMetadataKeyForLink(sourceId: string, targetId: string): string | null {
        const sourcePage: Page | undefined = this.api.page(sourceId);
        if (!sourcePage) return null;

        for (const [key, value] of Object.entries(sourcePage)) {
            const valueType = this.determineDataviewLinkType(value);

            switch (valueType) {
                case DataviewLinkType.WikiLink:
                    if (value.path === targetId) {
                        return key;
                    }
                    break;
                case DataviewLinkType.MarkdownLink:
                    if (this.extractPathFromMarkdownLink(value) === targetId) {
                        return key;
                    }
                    break;
                case DataviewLinkType.Array:
                    for (const item of value) {
                        if (this.determineDataviewLinkType(item) === DataviewLinkType.WikiLink && item.path === targetId) {
                            return key;
                        }
                        if (this.determineDataviewLinkType(item) === DataviewLinkType.MarkdownLink && this.extractPathFromMarkdownLink(item) === targetId) {
                            return key;
                        }
                    }
                    break;
                // Handle other cases as needed
            }
        }
        return null;
    }

    // Utility function to extract the file path from a Markdown link
    private extractPathFromMarkdownLink(markdownLink: string | unknown): string {
        const links = extractLinks(markdownLink).links;
        // The package returns an array of links. Assuming you want the first link.
        return links.length > 0 ? links[0] : '';
    }


    // Utility function to check if a value is a Markdown link
    isMarkdownLink(value: any, targetId: string): boolean {
        if (typeof value === 'string') {
            const path = this.extractPathFromMarkdownLink(value);
            return path === targetId;
        }
        return false;
    }

    // Utility function to check if a value is a link
    isWikiLink(value: any): boolean {
        return typeof value === 'object' && value.hasOwnProperty('path');
    }
    
    isCustomRenderer(renderer: any): renderer is CustomRenderer {
        return renderer 
            && renderer.px 
            && renderer.px.stage 
            && renderer.panX
            && renderer.panY
            && typeof renderer.px.stage.addChild === 'function' 
            && typeof renderer.px.stage.removeChild === 'function'
            && Array.isArray(renderer.links);
    }

    isCustomLink(link: any): link is CustomLink {
        return link 
            && link.source 
            && typeof link.source.id === 'string'
            && typeof link.source.x === 'number'
            && typeof link.source.y === 'number'
            && link.target 
            && typeof link.target.id === 'string'
            && typeof link.target.x === 'number'
            && typeof link.target.y === 'number';
    }

    determineTextColor(): string {
        // Get the computed style of the document body
        const style = getComputedStyle(document.body);

        // This is a basic check. You might need to adjust the logic based on the themes you support.
        // Here, we assume that dark themes have a background color with a low brightness value.
        let textColor = '#FF0000';
        if (style && style.backgroundColor && style.backgroundColor) {
            const isDarkTheme = style.backgroundColor.match(/\d+/g)?.map(Number).slice(0, 3).reduce((a, b) => a + b, 0) < 382.5;
            isDarkTheme ? textColor = '#FFFFFF' : textColor = '#000000'; // White text for dark themes, black for light themes)
        }

        return textColor
    }


}

