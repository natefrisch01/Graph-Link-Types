import { Plugin, WorkspaceLeaf, Notice} from 'obsidian';
import { getAPI, Page } from 'obsidian-dataview';
import * as PIXI from 'pixi.js';

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
                this.checkAndUpdateRenderer();
                this.startUpdateLoop(1);
            }
        });
    }

    // Get the metadata key for a link between two pages
    getMetadataKeyForLink(link : CustomLink): string | null {
        const sourceId : string = link.source.id;
        const targetId : string = link.target.id;
        // Retrieve the source page
        const sourcePage: Page | undefined = this.api.page(sourceId);
        if (!sourcePage) return null;

        // Loop through the properties of the source page
        for (const [key, value] of Object.entries(sourcePage)) {
            // Check if the value is a link and matches the targetId
            if (this.isDataviewLink(value) && value.path === targetId) {
                return key;
            }
            // Check if the value is an array of links and find a match
            if (Array.isArray(value)) {
                for (const linkDataView of value) {
                    if (this.isDataviewLink(linkDataView) && linkDataView.path === targetId) {
                        return key;
                    }
                }
            }
        }
        return null;
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
        console.log("layout-change");
        // Cancel the animation frame on layout change
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        await this.waitForRenderer();
        this.checkAndUpdateRenderer();
        console.log(this.currentRenderer);
    }

    checkAndUpdateRenderer() {
        const newRenderer = this.findRenderer();
        if (!newRenderer) {
            console.log("No Renderer Found");
            this.currentRenderer = null;
            return;
        }
        console.log("Renderer Found");
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
    createTextForLink(renderer: CustomRenderer, link: CustomLink): void {

        // Get the text to display for the link
        const linkString: string | null = this.getMetadataKeyForLink(link);
        if (linkString === null) return; //doesn't add if link is null

        // If text already exists for this link, remove it
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
        if (text) {
            // Set the position and scale of the text
            text.x = x;
            text.y = y;
            text.scale.set(1 / (3 * renderer.nodeScale));
        }
    }

    // Remove all text nodes from the graph
    destroyMap(renderer: CustomRenderer): void {
        console.log("Destroying Map");
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

    // Utility function to check if a value is a link
    isDataviewLink(value: any): boolean {
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


interface CustomRenderer {
    px: {
        stage: {
            addChild: (child: any) => void;
            removeChild: (child: any) => void;
            children: any[];
        };
    };
    links: any[];
    nodeScale: number;
    panX: number;
    panY: number;
    scale: number;
}

interface CustomLink {
    source: {
        id: string;
        x: number;
        y: number;
    };
    target: {
        id: string;
        x: number;
        y: number;
    };
}
