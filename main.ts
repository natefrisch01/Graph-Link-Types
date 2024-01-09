import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { getAPI, Page } from 'obsidian-dataview';
import * as PIXI from 'pixi.js';

export default class GraphLinkTypesPlugin extends Plugin {
    // Retrieve the Dataview API
    api = getAPI();
    // A map to keep track of the text nodes created for each link
    nodeTextMap: Map<string, PIXI.Text> = new Map();

    // Lifecycle method called when the plugin is loaded
    async onload(): Promise<void> {
        // Check if the Dataview API is available
        if (this.api) {
            // Register an event to start the update loop when the layout changes
            this.registerEvent(this.app.workspace.on('layout-change', () => {
                this.startUpdateLoop();
            }));

            // Add a command to the command palette
            this.addCommand({
                id: 'print-link-type',
                name: 'Print Link Type',
                // Command callback to start the update loop with verbosity
                callback: () => this.startUpdateLoop(1)
            });
        } else {
            console.error("Dataview plugin is not available.");
        }
    }

    // Get the metadata key for a link between two pages
    getMetadataKeyForLink(sourceId: string, targetId: string): string | null {
        // Retrieve the source page
        const sourcePage: Page | undefined = this.api.page(sourceId);
        if (!sourcePage) return null;

        // Loop through the properties of the source page
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

    // Utility function to check if a value is a link
    isLink(value: any): boolean {
        return typeof value === 'object' && value.hasOwnProperty('path');
    }

    // Find the graph view leaf in the workspace
    findGraphLeaf(): WorkspaceLeaf | null {
        let graphLeaves: WorkspaceLeaf[] = this.app.workspace.getLeavesOfType('graph');
        if (graphLeaves.length == 0) {
            graphLeaves = this.app.workspace.getLeavesOfType('localgraph');
        }
		// Ensure there is exactly one graph leaf open
        return graphLeaves.length > 0 ? graphLeaves[0] : null;
    }
	
    // Create or update text for a given link
    createTextForLink(renderer: any, link: any): void {
        // Get the text to display for the link
        const linkString: string | null = this.getMetadataKeyForLink(link.source.id, link.target.id);
        if (linkString === null) return;

        const linkKey: string = `${link.source.id}-${link.target.id}`;

        // If text already exists for this link, remove it
        if (this.nodeTextMap.has(linkKey)) {
            const existingText = this.nodeTextMap.get(linkKey)!;
            renderer.px.stage.removeChild(existingText);
            existingText.destroy();
        }

        // Define the style for the text
        const textStyle: PIXI.TextStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 36,
            fill: 0x000000
        });
        // Create new text node
        const text: PIXI.Text = new PIXI.Text(linkString, textStyle);
        text.alpha = 0.7;
        text.anchor.set(0.5, 0.5);
        // Add the text node to the map and the renderer
        this.nodeTextMap.set(linkKey, text);

        this.updateTextPosition(renderer, link);
        renderer.px.stage.addChild(text);
    }

    // Update the position of the text on the graph
    updateTextPosition(renderer: any, link: any): void {
        const linkKey: string = `${link.source.id}-${link.target.id}`;
        const text: PIXI.Text | undefined = this.nodeTextMap.get(linkKey);
        if (!text || !link.source || !link.target) {
            return;
        }
        // Calculate the mid-point of the link
        const midX: number = (link.source.x + link.target.x) / 2;
        const midY: number = (link.source.y + link.target.y) / 2;
        // Transform the mid-point coordinates based on the renderer's pan and scale
        const { x, y } = this.getLinkToTextCoordinates(midX, midY, renderer.panX, renderer.panY, renderer.scale);
        // Set the position and scale of the text
        text.x = x;
        text.y = y;
        text.scale.set(1 / (3 * renderer.nodeScale));
    }

    // Remove all text nodes from the graph
    destroyMap(renderer: any): void {
        console.log("Destroying Map");
        if (this.nodeTextMap.size > 0) {
            this.nodeTextMap.forEach((text, linkKey) => {
                if (text && renderer.px.stage.children.includes(text)) {
                    renderer.px.stage.removeChild(text);
                    text.destroy();
                }
                this.nodeTextMap.delete(linkKey);
            });
        }
    }

    // Function to start the update loop for rendering.
    startUpdateLoop(verbosity: number = 0): void {
        // Find the graph leaf in the workspace.
        const graphLeaf: WorkspaceLeaf | null = this.findGraphLeaf();
        if (!graphLeaf) {
            // Show a notice if no graph is found.
            if (verbosity > 0) {
                new Notice("No graph or multiple graphs present.");
            }
            return;
        }
        // Get the renderer from the graph leaf.
        const renderer: any = graphLeaf.view.renderer;
        // Remove existing text from the graph.
        this.destroyMap(renderer);
        // Create text for each link in the graph.
        renderer.links.forEach((link: any) => this.createTextForLink(renderer, link));
        // Call the function to update positions in the next animation frame.
        requestAnimationFrame(this.updatePositions.bind(this));
    }



    // Function to continuously update the positions of text objects.
    updatePositions(): void {
        // Find the graph leaf in the workspace.
        const graphLeaf: WorkspaceLeaf | null = this.findGraphLeaf();
        if (!graphLeaf) {
            return;
        }
        // Get the renderer from the graph leaf.
        const renderer: any = graphLeaf.view.renderer;

        // For each link in the graph, update the position of its text.
        renderer.links.forEach((link: any) => {
            const linkKey: string = `${link.source.id}-${link.target.id}`;
            if (!this.nodeTextMap.has(linkKey)) {
                this.createTextForLink(renderer, link);
            }
            this.updateTextPosition(renderer, link);
        });

        // Continue updating positions in the next animation frame.
        requestAnimationFrame(this.updatePositions.bind(this));
    }

    // Function to calculate the coordinates for placing the link text.
    getLinkToTextCoordinates(linkX: number, linkY: number, panX: number, panY: number, scale: number): { x: number, y: number } {
        // Apply scaling and panning to calculate the actual position.
        return { x: linkX * scale + panX, y: linkY * scale + panY };
    }
}
