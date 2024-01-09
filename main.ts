import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { getAPI, Page } from 'obsidian-dataview';
import * as PIXI from 'pixi.js';

export default class GraphLinkTypesPlugin extends Plugin {
    api = getAPI();
    nodeTextMap: Map<string, PIXI.Text> = new Map();

    async onload(): Promise<void> {
        if (this.api) {
            this.registerEvent(this.app.workspace.on('layout-change', () => {
                this.startUpdateLoop();
            }));

            this.addCommand({
                id: 'print-link-type',
                name: 'Print Link Type',
                callback: () => this.startUpdateLoop(1)
            });
        } else {
            console.error("Dataview plugin is not available.");
        }
    }

    getMetadataKeyForLink(sourceId: string, targetId: string): string | null {
        const sourcePage: Page | undefined = this.api.page(sourceId);
        if (!sourcePage) return null;

        for (const [key, value] of Object.entries(sourcePage)) {
            if (this.isLink(value) && value.path === targetId) {
                return key;
            }
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

    isLink(value: any): boolean {
        return typeof value === 'object' && value.hasOwnProperty('path');
    }

    findGraphLeaf(): WorkspaceLeaf | null {
        const graphLeaves: WorkspaceLeaf[] = this.app.workspace.getLeavesOfType('graph');
        return graphLeaves.length === 1 ? graphLeaves[0] : null;
    }

    createTextForLink(renderer: any, link: any): void {
        const linkString: string | null = this.getMetadataKeyForLink(link.source.id, link.target.id);
        if (linkString === null) return;

        const linkKey: string = `${link.source.id}-${link.target.id}`;

        if (this.nodeTextMap.has(linkKey)) {
            const existingText = this.nodeTextMap.get(linkKey)!;
            renderer.px.stage.removeChild(existingText);
            existingText.destroy();
        }

        const textStyle: PIXI.TextStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 36,
            fill: 0x000000
        });
        const text: PIXI.Text = new PIXI.Text(linkString, textStyle);
        text.alpha = 0.7;
        text.anchor.set(0.5, 0.5);
        this.nodeTextMap.set(linkKey, text);

        this.updateTextPosition(renderer, link);
        renderer.px.stage.addChild(text);
    }

    updateTextPosition(renderer: any, link: any): void {
        const linkKey: string = `${link.source.id}-${link.target.id}`;
        const text: PIXI.Text | undefined = this.nodeTextMap.get(linkKey);
        if (!text || !link.source || !link.target) {
            return;
        }
        const midX: number = (link.source.x + link.target.x) / 2;
        const midY: number = (link.source.y + link.target.y) / 2;
        const { x, y } = this.getLinkToTextCoordinates(midX, midY, renderer.panX, renderer.panY, renderer.scale);
        text.x = x;
        text.y = y;
        text.scale.set(1 / (3 * renderer.nodeScale));
    }

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

    startUpdateLoop(verbosity: number = 0): void {
        const graphLeaf: WorkspaceLeaf | null = this.findGraphLeaf();
        if (!graphLeaf) {
            if (verbosity > 0) {
                new Notice("No graph or multiple graphs present.");
            }
            return;
        }
        const renderer: any = graphLeaf.view.renderer;
        this.destroyMap(renderer);
        renderer.links.forEach((link: any) => this.createTextForLink(renderer, link));
        requestAnimationFrame(this.updatePositions.bind(this));
    }

    updatePositions(): void {
        const graphLeaf: WorkspaceLeaf | null = this.findGraphLeaf();
        if (!graphLeaf) {
            return;
        }
        const renderer: any = graphLeaf.view.renderer;

        renderer.links.forEach((link: any) => {
            const linkKey: string = `${link.source.id}-${link.target.id}`;
            if (!this.nodeTextMap.has(linkKey)) {
                this.createTextForLink(renderer, link);
            }
            this.updateTextPosition(renderer, link);
        });

        requestAnimationFrame(this.updatePositions.bind(this));
    }

    getLinkToTextCoordinates(linkX: number, linkY: number, panX: number, panY: number, scale: number): { x: number, y: number } {
        return { x: linkX * scale + panX, y: linkY * scale + panY };
    }
}
