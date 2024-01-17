
import { ObsidianRenderer, ObsidianLink, LinkPair, GltLink, DataviewLinkType } from 'types';
import { getAPI  } from 'obsidian-dataview';
import { Text, TextStyle }  from 'pixi.js';
// @ts-ignore
import extractLinks from 'markdown-link-extractor';


export class LinkManager {
    linksMap: Map<string, GltLink>;
    api = getAPI();
    currentTheme : string;
    textColor : string;

    constructor() {
        this.linksMap = new Map<string, GltLink>();

        // Detect changes to the theme.
        this.detectThemeChange();
    }

    generateKey(sourceId: string, targetId: string): string {
        return `${sourceId}-${targetId}`;
    }
    
    private detectThemeChange(): void {
        let lastTheme = '';
        let lastStyleSheetHref = '';
        let debounceTimer: number;
    
        const themeObserver = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => {
                this.currentTheme = document.body.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light';
                const currentStyleSheetHref = document.querySelector('link[rel="stylesheet"][href*="theme"]')?.getAttribute('href');
                if ((this.currentTheme && this.currentTheme !== lastTheme) || (currentStyleSheetHref !== lastStyleSheetHref)) {
                    this.textColor = this.getComputedColorFromClass(this.currentTheme, '--text-normal');
                    lastTheme = this.currentTheme;
                    if (currentStyleSheetHref) {
                        lastStyleSheetHref = currentStyleSheetHref;
                    }
                }
            }, 100); // Debounce delay
        });
    
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        themeObserver.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    }
    
    private getComputedColorFromClass(className : string, cssVariable : string) : string {
        // Create a temporary element
        const tempElement = document.createElement('div');
    
        // Apply the class to the temporary element
        tempElement.classList.add(className);
        document.body.appendChild(tempElement);
    
        // Get the computed style of the temporary element
        const style = getComputedStyle(tempElement);
        const colorValue = style.getPropertyValue(cssVariable).trim();
    
        // Remove the temporary element
        document.body.removeChild(tempElement);

        // Check if the color is in HSL format
        if (colorValue.startsWith('hsl')) {
            // Return a default color based on some condition, e.g., current theme
            // This is a placeholder condition
            return document.body.classList.contains('theme-dark') ? '#b3b3b3' : '#5c5c5c';
        } else {
            // If it's not HSL, return the color as-is
            return colorValue;
        }
    }

    addLink(renderer: ObsidianRenderer, obLink: ObsidianLink): void {
        const key = this.generateKey(obLink.source.id, obLink.target.id);
        const reverseKey = this.generateKey(obLink.target.id, obLink.source.id);
        const pairStatus = (obLink.source.id !== obLink.target.id) && this.linksMap.has(reverseKey) ? LinkPair.Second : LinkPair.None;
        const newLink: GltLink = {
            obsidianLink: obLink,
            pairStatus: pairStatus,
            pixiText: this.createTextForLink(renderer, obLink, pairStatus)
        };

        this.linksMap.set(key, newLink);

        if ((obLink.source.id !== obLink.target.id) && this.linksMap.has(reverseKey)) {
            const reverseLink = this.linksMap.get(reverseKey);
            if (reverseLink) {
                reverseLink.pairStatus = LinkPair.First;
            }
        }
    }

    removeLink(renderer: ObsidianRenderer, link: ObsidianLink): void {
        const key = this.generateKey(link.source.id, link.target.id);
        const reverseKey = this.generateKey(link.target.id, link.source.id);

        const gltLink = this.linksMap.get(key);
        
        if (gltLink && gltLink.pixiText && renderer.px && renderer.px.stage && renderer.px.stage.children && renderer.px.stage.children.includes(gltLink.pixiText)) {
            renderer.px.stage.removeChild(gltLink.pixiText);
            gltLink.pixiText.destroy();
        }

        this.linksMap.delete(key);

        const reverseLink = this.linksMap.get(reverseKey);
        if (reverseLink && reverseLink.pairStatus !== LinkPair.None) {
            reverseLink.pairStatus = LinkPair.None;
        }
    }

    removeLinks(renderer: ObsidianRenderer, currentLinks: ObsidianLink[]): void {
        const currentKeys = new Set(currentLinks.map(link => this.generateKey(link.source.id, link.target.id)));
        // remove any links in our map that aren't in this list
        this.linksMap.forEach((_, key) => {
            if (!currentKeys.has(key)) {
                const link = this.linksMap.get(key);
                if (link) {
                    this.removeLink(renderer, link.obsidianLink);
                }
            }
        });
    }

    getLinkPairStatus(key: string): LinkPair {
        const link = this.linksMap.get(key);
        return link ? link.pairStatus : LinkPair.None;
    }

    // Update the position of the text on the graph
    updateTextPosition(renderer: ObsidianRenderer, link: ObsidianLink): void {
        if (!renderer || !link || !link.source || !link.target) {
            // If any of these are null, exit the function
            return;
        }
        const linkKey = this.generateKey(link.source.id, link.target.id);
        const obsLink = this.linksMap.get(linkKey);
        let text;
        if (obsLink) {
            text = obsLink.pixiText;
        } else {
            return
        };

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
            text.style.fill = this.textColor;
        }
    }

    // Create or update text for a given link
    private createTextForLink(renderer: ObsidianRenderer, link: ObsidianLink, pairStatus : LinkPair): Text | null{

        // Get the text to display for the link
        let linkString: string | null = this.getMetadataKeyForLink(link.source.id, link.target.id);
        if (linkString === null) {
            return null;
        } //doesn't add if link is null
        if (link.source.id === link.target.id) {
            linkString = "";
        }

        if (pairStatus === LinkPair.None) {

        } else if (pairStatus === LinkPair.First) {
            linkString = linkString + "\n\n";
        } else if (pairStatus === LinkPair.Second) {
            linkString = "\n\n" + linkString;
        } else {

        }
        // Define the style for the text
        const textStyle: TextStyle = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 36,
            fill: this.textColor
        });
        // Create new text node
        const text: Text = new Text(linkString, textStyle);
        text.alpha = 0.7;
        text.anchor.set(0.5, 0.5);


        this.updateTextPosition(renderer, link);
        renderer.px.stage.addChild(text);
        return text
    }

    // Utility function to extract the file path from a Markdown link
    private extractPathFromMarkdownLink(markdownLink: string | unknown): string {
        const links = extractLinks(markdownLink).links;
        // The package returns an array of links. Assuming you want the first link.
        return links.length > 0 ? links[0] : '';
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

    // Remove all text nodes from the graph
    destroyMap(renderer: ObsidianRenderer): void {
        if (this.linksMap.size > 0) {
            this.linksMap.forEach((gltLink, linkKey) => {
                if (gltLink.pixiText && renderer.px && renderer.px.stage && renderer.px.stage.children && renderer.px.stage.children.includes(gltLink.pixiText)) {
                    renderer.px.stage.removeChild(gltLink.pixiText);
                    gltLink.pixiText.destroy();
                }
                this.linksMap.delete(linkKey);
            });
        }
    }

    // Get the metadata key for a link between two pages
    private getMetadataKeyForLink(sourceId: string, targetId: string): string | null {
        const sourcePage: any = this.api.page(sourceId);
        if (!sourcePage) return null;

        for (const [key, value] of Object.entries(sourcePage)) {
            const valueType = this.determineDataviewLinkType(value);

            switch (valueType) {
                case DataviewLinkType.WikiLink:
                    // @ts-ignore
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
                    // @ts-ignore
                    for (const item of value) {
                        if (this.determineDataviewLinkType(item) === DataviewLinkType.WikiLink && item.path === targetId) {
                            return key;
                        }
                        if (this.determineDataviewLinkType(item) === DataviewLinkType.MarkdownLink && this.extractPathFromMarkdownLink(item) === targetId) {
                            return key;
                        }
                    }
                    break;
                default:
                    //metadata is not a link, return null
                    return null;
            }
        }
        return null;
    }

    // Function to calculate the coordinates for placing the link text.
    private getLinkToTextCoordinates(linkX: number, linkY: number, panX: number, panY: number, scale: number): { x: number, y: number } {
        // Apply scaling and panning to calculate the actual position.
        return { x: linkX * scale + panX, y: linkY * scale + panY };
    }
        
}