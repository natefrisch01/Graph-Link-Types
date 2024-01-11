import { Plugin, Notice} from 'obsidian';
import { getAPI } from 'obsidian-dataview';
import { ObsidianRenderer, ObsidianLink, LinkPair} from 'types';
import { LinkManager } from 'linkManager';


export default class GraphLinkTypesPlugin extends Plugin {
    api = getAPI();
    currentRenderer: ObsidianRenderer | null = null;
    animationFrameId: number | null = null;
    linkManager = new LinkManager();

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

        this.registerEvent(this.app.metadataCache.on("dataview:index-ready", () => {
            console.log("Index ready, drawing graph link types.");
            this.handleLayoutChange();
        }));

        this.registerEvent(this.app.metadataCache.on("dataview:metadata-change", () => {
            console.log("New metadata, drawing graph link types.");
            this.handleLayoutChange();
        }));

        // // Add a command to the command palette
        // this.addCommand({
        //     id: 'print-link-type',
        //     name: 'Print Link Type',
        //     callback: () => {
        //         this.toyLinks();
        //     }
        // });
    }





    // Find the first valid graph renderer in the workspace
    findRenderer(): ObsidianRenderer | null {
        let graphLeaves = this.app.workspace.getLeavesOfType('graph');
        for (const leaf of graphLeaves) {
            const renderer = leaf.view.renderer;
            if (this.isObsidianRenderer(renderer)) {
                return renderer;
            }
        }

        graphLeaves = this.app.workspace.getLeavesOfType('localgraph');
        for (const leaf of graphLeaves) {
            const renderer = leaf.view.renderer;
            if (this.isObsidianRenderer(renderer)) {
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

    // Function to start the update loop for rendering.
    startUpdateLoop(verbosity: number = 0): void {
        if (!this.currentRenderer) {
            if (verbosity > 0) {
                new Notice('No valid graph renderer found.');
            }
            return;
        }
        const renderer : ObsidianRenderer = this.currentRenderer;
        // Remove existing text from the graph.
        this.linkManager.destroyMap(renderer);
       
        // Call the function to update positions in the next animation frame.
        requestAnimationFrame(this.updatePositions.bind(this));
    }


    // Function to continuously update the positions of text objects.
    updatePositions(): void {

        // Find the graph renderer in the workspace.
        if (!this.currentRenderer) {
            return;
        }



        const renderer: ObsidianRenderer = this.currentRenderer;

        let updateMap = false;

        if (this.animationFrameId && this.animationFrameId % 20 == 0) {
            updateMap = true;
            // Update link manager with the current frame's links
            this.linkManager.removeLinks(renderer, renderer.links);
        }
        
        // For each link in the graph, update the position of its text.
        renderer.links.forEach((link: ObsidianLink) => {
            if (updateMap) {
                const key = this.linkManager.generateKey(link.source.id, link.target.id);
                if (!this.linkManager.linksMap.has(key)) {
                    this.linkManager.addLink(renderer, link);
                }
            }
            this.linkManager.updateTextPosition(renderer, link);
        });

        // Continue updating positions in the next animation frame.
        this.animationFrameId = requestAnimationFrame(this.updatePositions.bind(this));
    }

    private isObsidianRenderer(renderer: any): renderer is ObsidianRenderer {
        return renderer 
            && renderer.px 
            && renderer.px.stage 
            && renderer.panX
            && renderer.panY
            && typeof renderer.px.stage.addChild === 'function' 
            && typeof renderer.px.stage.removeChild === 'function'
            && Array.isArray(renderer.links);
    }
}

