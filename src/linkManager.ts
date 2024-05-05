
import { ObsidianRenderer, ObsidianLink, LinkPair, GltLink, DataviewLinkType , GltLegendGraphic} from 'src/types';
import { getAPI  } from 'obsidian-dataview';
import { Text, TextStyle , Graphics, Color}  from 'pixi.js';
// @ts-ignore
import extractLinks from 'markdown-link-extractor';


export class LinkManager {
    linksMap: Map<string, GltLink>;
    api = getAPI();
    currentTheme : string;
    textColor : string;
    tagColors: Map<string, GltLegendGraphic>;
    categoricalColors: number[] = [
        0xF44336, // Red
        0x03A9F4, // Light Blue
        0xFF9800, // Orange
        0x9C27B0, // Purple
        0xCDDC39, // Lime
        0x3F51B5, // Indigo
        0xFFC107, // Amber
        0x00BCD4, // Cyan
        0xE91E63, // Pink
        0x4CAF50, // Green
        0xFF5722, // Deep Orange
        0x673AB7, // Deep Purple
        0x9E9E9E, // Grey
        0x2196F3, // Blue
        0x8BC34A, // Light Green
        0x795548, // Brown
        0x009688, // Teal
        0x607D8B, // Blue Grey
        0xFFEB3B, // Yellow
        0x000000  // Black for contrast
    ]

      
      currentTagColorIndex = 0;
      yOffset = 5; // To increment the y position for each legend item
      xOffset = 20;
      lineHeight = 17; // Height of each line in the legend
      lineLength = 40; // Width of the color line
      spaceBetweenTextAndLine = 1; // Space between the text and the start of the line


    constructor() {
        this.linksMap = new Map<string, GltLink>();
        this.tagColors = new Map<string, GltLegendGraphic>();

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

    addLink(renderer: ObsidianRenderer, obLink: ObsidianLink, tagColors: boolean, tagLegend: boolean): void {
        const key = this.generateKey(obLink.source.id, obLink.target.id);
        const reverseKey = this.generateKey(obLink.target.id, obLink.source.id);
        const pairStatus = (obLink.source.id !== obLink.target.id) && this.linksMap.has(reverseKey) ? LinkPair.Second : LinkPair.None;
        const newLink: GltLink = {
            obsidianLink: obLink,
            pairStatus: pairStatus,
            pixiText: this.initializeLinkText(renderer, obLink, pairStatus),
            pixiGraphics: tagColors ? this.initializeLinkGraphics(renderer, obLink, tagLegend) : null,
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

        if (gltLink && gltLink.pixiGraphics && renderer.px && renderer.px.stage && renderer.px.stage.children && renderer.px.stage.children.includes(gltLink.pixiGraphics)) {
            renderer.px.stage.removeChild(gltLink.pixiGraphics);
            gltLink.pixiGraphics.destroy();
        }

        let colorKey = gltLink?.pixiText?.text?.replace(/\r?\n/g, "");
        if (colorKey) {
            if (this.tagColors.has(colorKey)) {
                const legendGraphic = this.tagColors.get(colorKey);
                if (legendGraphic) {
                    legendGraphic.nUsing -= 1;
                    if (legendGraphic.nUsing < 1) {
                        this.yOffset -= this.lineHeight;
                        this.currentTagColorIndex -= 1;
                        if (this.currentTagColorIndex < 0) this.currentTagColorIndex = this.categoricalColors.length - 1;
                        if (legendGraphic.legendText && renderer.px && renderer.px.stage && renderer.px.stage.children && renderer.px.stage.children.includes(legendGraphic.legendText)) {
                            renderer.px.stage.removeChild(legendGraphic.legendText);
                            legendGraphic.legendText.destroy();
                        }
                        if (legendGraphic.legendGraphics && renderer.px && renderer.px.stage && renderer.px.stage.children && renderer.px.stage.children.includes(legendGraphic.legendGraphics)) {
                            renderer.px.stage.removeChild(legendGraphic.legendGraphics);
                            legendGraphic.legendGraphics.destroy();
                        }
                        this.tagColors.delete(colorKey);
                    }
                }
            }
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
    updateLinkText(renderer: ObsidianRenderer, link: ObsidianLink, tagNames: boolean): void {
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
            if (tagNames) {
                text.alpha = 0.9;
            } else {
                text.alpha = 0.0;
            }
        }
    }

    // Update the position of the text on the graph
    updateLinkGraphics(renderer: ObsidianRenderer, link: ObsidianLink): void {
        if (!renderer || !link || !link.source || !link.target) {
            // If any of these are null, exit the function
            return;
        }
        const linkKey = this.generateKey(link.source.id, link.target.id);
        const gltLink = this.linksMap.get(linkKey);
        let graphics;
        if (gltLink) {
            graphics = gltLink.pixiGraphics;
        } else {
            return
        };
        let {nx, ny} = this.calculateNormal(link.source.x, link.source.y, link.target.x, link.target.y);
        let {px, py} = this.calculateParallel(link.source.x, link.source.y, link.target.x, link.target.y);
        
        nx *= 1.5*Math.sqrt(renderer.scale);
        ny *= 1.5*Math.sqrt(renderer.scale);

        px *= 8*Math.sqrt(renderer.scale);
        py *= 8*Math.sqrt(renderer.scale);
  

        let { x:x1, y:y1 } = this.getLinkToTextCoordinates(link.source.x, link.source.y, renderer.panX, renderer.panY, renderer.scale);
        let { x:x2, y:y2 } = this.getLinkToTextCoordinates(link.target.x, link.target.y, renderer.panX, renderer.panY, renderer.scale);
        x1 += nx + (link.source.weight/36+1) * px;
        x2 += nx - (link.target.weight/36+1) * px;
        y1 += ny + (link.source.weight/36+1) * py;
        y2 += ny - (link.target.weight/36+1) * py;
      

        if (graphics && renderer.px && renderer.px.stage && renderer.px.stage.children && renderer.px.stage.children.includes(graphics)) {
            // @ts-ignore
            const color = graphics._lineStyle.color;
            // Now, update the line whenever needed without creating a new graphics object each time
            graphics.clear(); // Clear the previous drawing to prepare for the update
            graphics.lineStyle(3/Math.sqrt(renderer.nodeScale), color); // Set the line style (width: 2px, color: black, alpha: 1)
            graphics.alpha = .6;
            graphics.moveTo(x1, y1); // Move to the starting point of the line (source node)
            graphics.lineTo(x2, y2); // Draw the line to the ending point (target node)
        }
    }

    // Create or update text for a given link
    private initializeLinkText(renderer: ObsidianRenderer, link: ObsidianLink, pairStatus : LinkPair): Text | null{

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

        text.zIndex = 1;
        text.anchor.set(0.5, 0.5);



        this.updateLinkText(renderer, link, false);
        renderer.px.stage.addChild(text);
        
        return text
    }

    // Create or update text for a given link
    private initializeLinkGraphics(renderer: ObsidianRenderer, link: ObsidianLink, tagLegend: boolean): Graphics | null{

        // Get the text to display for the link
        let linkString: string | null = this.getMetadataKeyForLink(link.source.id, link.target.id);
        if (linkString === null) {
            return null;
        } //doesn't add if link is null

        let color;
        
        if (link.source.id === link.target.id) {
            linkString = "";
        } else {


            if (!this.tagColors.has(linkString)) { // this tag is not in the map yet
                color = this.categoricalColors[this.currentTagColorIndex];

                // Increment and wrap the index to cycle through colors
                this.currentTagColorIndex = (this.currentTagColorIndex + 1) % this.categoricalColors.length;

                // Create and add the label
                const textL = new Text(linkString, { fontFamily: 'Arial', fontSize: 14, fill: this.textColor });
                textL.x = this.xOffset;
                textL.y = this.yOffset;
                renderer.px.stage.addChild(textL);

                    // Calculate the starting x-coordinate for the line, based on the text width
                const lineStartX = this.xOffset + textL.width + this.spaceBetweenTextAndLine;

                const graphicsL = new Graphics();
                graphicsL.lineStyle(2, color, 1); // Assuming 'color' is in a PIXI-compatible format
                graphicsL.moveTo(lineStartX, this.yOffset + (this.lineHeight / 2)); // Start a little below the text
                graphicsL.lineTo(lineStartX + this.lineLength, this.yOffset + (this.lineHeight / 2)); // 40 pixels wide line
                renderer.px.stage.addChild(graphicsL);
                this.yOffset += this.lineHeight;

                if (!tagLegend) {
                    graphicsL.alpha = 0.0;
                    textL.alpha = 0.0;
                }
                const newLegendGraphic: GltLegendGraphic = {
                    color: color,
                    legendText: textL,
                    legendGraphics: graphicsL,
                    nUsing: 0,
                };

                this.tagColors.set(linkString, newLegendGraphic);
            } else {                              // this tag is in the map already
                const legendGraphic = this.tagColors.get(linkString)
                
                if (legendGraphic) {
                    color = legendGraphic?.color;
                    legendGraphic.nUsing += 1;
                } else {
                    color = 0xFFFFFF;
                }
            }
        }


        const graphics = new Graphics();
        graphics.lineStyle(3/Math.sqrt(renderer.nodeScale), color)
        graphics.zIndex = 0;
        renderer.px.stage.addChild(graphics); // Add the line to the stage


        this.updateLinkGraphics(renderer, link);

        
        return graphics
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
                this.removeLink(renderer, gltLink.obsidianLink)   
            });
        }
    }

    // Get the metadata key for a link between two pages
    private getMetadataKeyForLink(sourceId: string, targetId: string): string | null {
        const sourcePage: any = this.api.page(sourceId);
        if (!sourcePage) return null;

        for (const [key, value] of Object.entries(sourcePage)) {
			// Skip empty values 
			if (value === null || value === undefined || value === '') {
            	continue;
        	}
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

    private calculateNormal(sourceX: number, sourceY: number, targetX: number, targetY: number): { nx: number; ny: number; } {
        // Calculate the direction vector D
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
    
        // Calculate the normal vector N by rotating D by 90 degrees
        let nx = -dy;
        let ny = dx;
    
        // Normalize the normal vector to get a unit vector
        const length = Math.sqrt(nx * nx + ny * ny);
        nx /= length; // Normalize the x component
        ny /= length; // Normalize the y component
    

        return { nx, ny };
    }
       
    private calculateParallel(sourceX: number, sourceY: number, targetX: number, targetY: number): { px: number; py: number; } {
        // Calculate the direction vector D from source to target
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
    
        // No need to rotate the vector for a parallel vector
    
        // Normalize the direction vector to get a unit vector
        const length = Math.sqrt(dx * dx + dy * dy);
        const px = dx / length; // Normalize the x component
        const py = dy / length; // Normalize the y component
    
        return { px, py };
    }
    
}
