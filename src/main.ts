import { Plugin, Notice, App, PluginSettingTab, Setting } from 'obsidian';
import { getAPI } from 'obsidian-dataview';
import { ObsidianRenderer, ObsidianLink } from 'src/types';
import { LinkManager } from 'src/linkManager';

export interface GraphLinkTypesPluginSettings {
    tagColors: boolean;
    tagNames: boolean;
    tagLegend: boolean;
    tagDirection: boolean;
}

const DEFAULT_SETTINGS: GraphLinkTypesPluginSettings = {
    tagColors: false,
    tagNames: true,
    tagLegend: true,
    tagDirection: false,
};

class GraphLinkTypesSettingTab extends PluginSettingTab {
    plugin: GraphLinkTypesPlugin;

    constructor(app: App, plugin: GraphLinkTypesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Type Names')
            .setDesc('Toggle to enable or disable link type names in the graph view.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.tagNames)
                .onChange(async (value) => {
                    this.plugin.settings.tagNames = value;
                    await this.plugin.saveSettings();
                    this.plugin.startUpdateLoop();
                }));

        new Setting(containerEl)
            .setName('Type Colors')
            .setDesc('Toggle to enable or disable link type colors in the graph view.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.tagColors)
                .onChange(async (value) => {
                    this.plugin.settings.tagColors = value;
                    await this.plugin.saveSettings();
                    this.plugin.startUpdateLoop();
                }));

        new Setting(containerEl)
            .setName('Show Legend')
            .setDesc('Toggle to show or hide the legend for link type colors in the graph view.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.tagLegend)
                .onChange(async (value) => {
                    this.plugin.settings.tagLegend = value;
                    await this.plugin.saveSettings();
                    this.plugin.startUpdateLoop();
                }));

        new Setting(containerEl)
            .setName('Show Direction')
            .setDesc('Toggle to show or hide relationship direction arrows in the graph view.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.tagDirection)
                .onChange(async (value) => {
                    this.plugin.settings.tagDirection = value;
                    await this.plugin.saveSettings();
                    this.plugin.startUpdateLoop();
                }));
    }
}

export default class GraphLinkTypesPlugin extends Plugin {
    settings: GraphLinkTypesPluginSettings;
    api: ReturnType<typeof getAPI> = null;
    currentRenderer: ObsidianRenderer | null = null;
    animationFrameId: number | null = null;
    linkManager = new LinkManager();
    indexReady = false;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new GraphLinkTypesSettingTab(this.app, this));

        // Try to get Dataview API. It may not be ready yet if Dataview
        // loads after this plugin.
        this.api = getAPI();

        if (!this.api) {
            // Dataview not ready yet. Wait for its API registration event.
            // @ts-ignore
            this.registerEvent(this.app.metadataCache.on('dataview:api-ready', () => {
                this.api = getAPI();
                this.linkManager.api = this.api;
                this.initEventHandlers();

                // Only start rendering if a graph view is already open.
                // Otherwise layout-change handler picks it up when one opens.
                if (this.currentRenderer) {
                    this.startUpdateLoop();
                }
            }));

            return;
        }

        this.linkManager.api = this.api;
        this.initEventHandlers();
    }

    private initEventHandlers(): void {
        this.registerEvent(this.app.workspace.on('layout-change', () => {
            this.handleLayoutChange();
        }));

        // @ts-ignore
        this.registerEvent(this.app.metadataCache.on('dataview:index-ready', () => {
            this.indexReady = true;
        }));

        // @ts-ignore
        this.registerEvent(this.app.metadataCache.on('dataview:metadata-change', () => {
            if (this.indexReady) {
                this.handleLayoutChange();
            }
        }));
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    findRenderer(): ObsidianRenderer | null {
        let graphLeaves = this.app.workspace.getLeavesOfType('graph');

        for (const leaf of graphLeaves) {
            // @ts-ignore
            const renderer = leaf.view.renderer;

            if (this.isObsidianRenderer(renderer)) {
                return renderer;
            }
        }

        graphLeaves = this.app.workspace.getLeavesOfType('localgraph');

        for (const leaf of graphLeaves) {
            // @ts-ignore
            const renderer = leaf.view.renderer;

            if (this.isObsidianRenderer(renderer)) {
                return renderer;
            }
        }

        return null;
    }

    async handleLayoutChange(): Promise<void> {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        await this.waitForRenderer();
        this.checkAndUpdateRenderer();
    }

    checkAndUpdateRenderer(): void {
        const newRenderer = this.findRenderer();

        if (!newRenderer) {
            this.currentRenderer = null;
            return;
        }

        newRenderer.px.stage.sortableChildren = true;
        this.currentRenderer = newRenderer;
        this.startUpdateLoop();
    }

    waitForRenderer(): Promise<void> {
        return new Promise((resolve) => {
            const checkInterval = 500;
            const maxWait = 10000;
            let elapsed = 0;

            const intervalId = setInterval(() => {
                const renderer = this.findRenderer();
                elapsed += checkInterval;

                if (renderer || elapsed >= maxWait) {
                    clearInterval(intervalId);
                    resolve();
                }
            }, checkInterval);
        });
    }

    startUpdateLoop(verbosity: number = 0): void {
        if (!this.currentRenderer) {
            if (verbosity > 0) {
                new Notice('No valid graph renderer found.');
            }

            return;
        }

        const renderer: ObsidianRenderer = this.currentRenderer;

        // Remove existing text, graphics, and arrows from the graph.
        this.linkManager.destroyMap(renderer);

        requestAnimationFrame(this.updatePositions.bind(this));
    }

    updatePositions(): void {
        if (!this.currentRenderer) {
            return;
        }

        const renderer: ObsidianRenderer = this.currentRenderer;

        let updateMap = false;

        if (this.animationFrameId && this.animationFrameId % 10 === 0) {
            updateMap = true;

            // Update link manager with the current frame's links.
            this.linkManager.removeLinks(renderer, renderer.links);
        }

        renderer.links.forEach((link: ObsidianLink) => {
            // Guard against null source/target.
            // This can happen with broken wikilinks.
            if (!link || !link.source || !link.target) {
                return;
            }

            if (updateMap) {
                const key = this.linkManager.generateKey(link.source.id, link.target.id);

                if (!this.linkManager.linksMap.has(key)) {
                    this.linkManager.addLink(
                        renderer,
                        link,
                        this.settings.tagColors,
                        this.settings.tagLegend
                    );
                }
            }

            this.linkManager.updateLinkText(
                renderer,
                link,
                this.settings.tagNames
            );

            if (this.settings.tagColors) {
                this.linkManager.updateLinkGraphics(renderer, link);
            }

            // New feature: direction arrows.
            // This requires LinkManager.updateLinkDirection(...) to be implemented.
            this.linkManager.updateLinkDirection(
                renderer,
                link,
                this.settings.tagDirection
            );
        });

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