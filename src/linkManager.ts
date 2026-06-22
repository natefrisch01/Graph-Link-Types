import { ObsidianRenderer, ObsidianLink, LinkPair, GltLink, DataviewLinkType, GltLegendGraphic } from 'src/types';

import { Text, TextStyle, Graphics } from 'pixi.js';
// @ts-ignore
import extractLinks from 'markdown-link-extractor';

type RelationshipDirectionOverride = 'default' | 'none' | 'both';

interface ParsedRelationshipKey {
    label: string;
    direction: RelationshipDirectionOverride;
}

export class LinkManager {
    linksMap: Map<string, GltLink>;
    api: any = null;
    currentTheme: string;
    textColor: string;
    tagColors: Map<string, GltLegendGraphic>;

    categoricalColors: number[] = [
        0xF44336,
        0x03A9F4,
        0xFF9800,
        0x9C27B0,
        0xCDDC39,
        0x3F51B5,
        0xFFC107,
        0x00BCD4,
        0xE91E63,
        0x4CAF50,
        0xFF5722,
        0x673AB7,
        0x9E9E9E,
        0x2196F3,
        0x8BC34A,
        0x795548,
        0x009688,
        0x607D8B,
        0xFFEB3B,
        0x000000
    ];

    currentTagColorIndex = 0;
    yOffset = 5;
    xOffset = 20;
    lineHeight = 17;
    lineLength = 40;
    spaceBetweenTextAndLine = 1;

    constructor() {
        this.linksMap = new Map<string, GltLink>();
        this.tagColors = new Map<string, GltLegendGraphic>();
        this.textColor = document.body.classList.contains('theme-dark') ? '#b3b3b3' : '#5c5c5c';
        this.currentTheme = document.body.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light';

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
            }, 100);
        });

        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        themeObserver.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    }

    private getComputedColorFromClass(className: string, cssVariable: string): string {
        const tempElement = document.createElement('div');

        tempElement.classList.add(className);
        document.body.appendChild(tempElement);

        const style = getComputedStyle(tempElement);
        const colorValue = style.getPropertyValue(cssVariable).trim();

        document.body.removeChild(tempElement);

        if (colorValue.startsWith('hsl')) {
            return document.body.classList.contains('theme-dark') ? '#b3b3b3' : '#5c5c5c';
        }

        return colorValue;
    }

    addLink(renderer: ObsidianRenderer, obLink: ObsidianLink, tagColors: boolean, tagLegend: boolean): void {
        const key = this.generateKey(obLink.source.id, obLink.target.id);
        const reverseKey = this.generateKey(obLink.target.id, obLink.source.id);

        const pairStatus =
            (obLink.source.id !== obLink.target.id) && this.linksMap.has(reverseKey)
                ? LinkPair.Second
                : LinkPair.None;

        const newLink: GltLink = {
            obsidianLink: obLink,
            pairStatus: pairStatus,
            pixiText: this.initializeLinkText(renderer, obLink, pairStatus),
            pixiGraphics: tagColors ? this.initializeLinkGraphics(renderer, obLink, tagLegend) : null,
        };

        // Dev extension without requiring src/types.ts changes yet.
        (newLink as any).pixiArrow = this.initializeLinkDirection(renderer, obLink);

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

        if (gltLink && gltLink.pixiText && renderer.px?.stage?.children?.includes(gltLink.pixiText)) {
            renderer.px.stage.removeChild(gltLink.pixiText);
            gltLink.pixiText.destroy();
        }

        if (gltLink && gltLink.pixiGraphics && renderer.px?.stage?.children?.includes(gltLink.pixiGraphics)) {
            renderer.px.stage.removeChild(gltLink.pixiGraphics);
            gltLink.pixiGraphics.destroy();
        }

        const arrow = (gltLink as any)?.pixiArrow as Graphics | null;
        if (arrow && renderer.px?.stage?.children?.includes(arrow)) {
            renderer.px.stage.removeChild(arrow);
            arrow.destroy();
        }

        const colorKey = gltLink?.pixiText?.text?.replace(/\r?\n/g, '');

        if (colorKey && this.tagColors.has(colorKey)) {
            const legendGraphic = this.tagColors.get(colorKey);

            if (legendGraphic) {
                legendGraphic.nUsing -= 1;

                if (legendGraphic.nUsing < 1) {
                    this.yOffset -= this.lineHeight;
                    this.currentTagColorIndex -= 1;

                    if (this.currentTagColorIndex < 0) {
                        this.currentTagColorIndex = this.categoricalColors.length - 1;
                    }

                    if (legendGraphic.legendText && renderer.px?.stage?.children?.includes(legendGraphic.legendText)) {
                        renderer.px.stage.removeChild(legendGraphic.legendText);
                        legendGraphic.legendText.destroy();
                    }

                    if (legendGraphic.legendGraphics && renderer.px?.stage?.children?.includes(legendGraphic.legendGraphics)) {
                        renderer.px.stage.removeChild(legendGraphic.legendGraphics);
                        legendGraphic.legendGraphics.destroy();
                    }

                    this.tagColors.delete(colorKey);
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
        const currentKeys = new Set(
            currentLinks
                .filter(link => link && link.source && link.target)
                .map(link => this.generateKey(link.source.id, link.target.id))
        );

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

    updateLinkText(renderer: ObsidianRenderer, link: ObsidianLink, tagNames: boolean): void {
        if (!renderer || !link || !link.source || !link.target) {
            return;
        }

        const linkKey = this.generateKey(link.source.id, link.target.id);
        const gltLink = this.linksMap.get(linkKey);

        if (!gltLink) {
            return;
        }

        const text = gltLink.pixiText;

        const midX = (link.source.x + link.target.x) / 2;
        const midY = (link.source.y + link.target.y) / 2;

        const { x, y } = this.getLinkToTextCoordinates(
            midX,
            midY,
            renderer.panX,
            renderer.panY,
            renderer.scale
        );

        if (text && renderer.px?.stage?.children?.includes(text)) {
            text.x = x;
            text.y = y;
            text.scale.set(1 / (3 * renderer.nodeScale));
            text.style.fill = this.textColor;

            if (tagNames) {
                text.alpha = this.getLinkAlpha(link);
            } else {
                text.alpha = 0.0;
            }
        }
    }

    updateLinkGraphics(renderer: ObsidianRenderer, link: ObsidianLink): void {
        if (!renderer || !link || !link.source || !link.target) {
            return;
        }

        const linkKey = this.generateKey(link.source.id, link.target.id);
        const gltLink = this.linksMap.get(linkKey);

        if (!gltLink) {
            return;
        }

        const graphics = gltLink.pixiGraphics;

        if (!graphics) {
            return;
        }

        let { nx, ny } = this.calculateNormal(link.source.x, link.source.y, link.target.x, link.target.y);
        let { px, py } = this.calculateParallel(link.source.x, link.source.y, link.target.x, link.target.y);

        nx *= 1.5 * Math.sqrt(renderer.scale);
        ny *= 1.5 * Math.sqrt(renderer.scale);

        px *= 8 * Math.sqrt(renderer.scale);
        py *= 8 * Math.sqrt(renderer.scale);

        let { x: x1, y: y1 } = this.getLinkToTextCoordinates(link.source.x, link.source.y, renderer.panX, renderer.panY, renderer.scale);
        let { x: x2, y: y2 } = this.getLinkToTextCoordinates(link.target.x, link.target.y, renderer.panX, renderer.panY, renderer.scale);

        x1 += nx + (link.source.weight / 36 + 1) * px;
        x2 += nx - (link.target.weight / 36 + 1) * px;
        y1 += ny + (link.source.weight / 36 + 1) * py;
        y2 += ny - (link.target.weight / 36 + 1) * py;

        if (renderer.px?.stage?.children?.includes(graphics)) {
            // @ts-ignore
            const color = graphics._lineStyle.color;

            graphics.clear();
            graphics.lineStyle(3 / Math.sqrt(renderer.nodeScale), color);
            graphics.alpha = 0.6;
            graphics.moveTo(x1, y1);
            graphics.lineTo(x2, y2);
        }
    }

    updateLinkDirection(renderer: ObsidianRenderer, link: ObsidianLink, tagDirection: boolean): void {
        if (!renderer || !link || !link.source || !link.target) {
            return;
        }

        const linkKey = this.generateKey(link.source.id, link.target.id);
        const gltLink = this.linksMap.get(linkKey);

        if (!gltLink) {
            return;
        }

        const arrow = (gltLink as any).pixiArrow as Graphics | null;

        if (!arrow) {
            return;
        }

        const rawRelationshipName = this.getMetadataKeyForLink(link.source.id, link.target.id);

        if (!rawRelationshipName) {
            arrow.visible = false;
            arrow.clear();
            return;
        }

        const relationship = this.parseRelationshipKey(rawRelationshipName);

        if (!tagDirection || relationship.direction === 'none' || link.source.id === link.target.id) {
            arrow.visible = false;
            arrow.clear();
            return;
        }

        if (!renderer.px?.stage?.children?.includes(arrow)) {
            renderer.px.stage.addChild(arrow);
        }

        arrow.visible = true;
        arrow.clear();

        const sourceX = link.source.x;
        const sourceY = link.source.y;
        const targetX = link.target.x;
        const targetY = link.target.y;

        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (!Number.isFinite(length) || length < 0.001) {
            arrow.visible = false;
            return;
        }

        const fillColor = this.hexColorStringToNumber(this.textColor, 0xffffff);
        const alpha = this.getLinkAlpha(link);

        // Normal arrow: source -> target.
        this.drawArrowHead(
            arrow,
            renderer,
            sourceX,
            sourceY,
            targetX,
            targetY,
            0.80,
            fillColor,
            alpha
        );

        // Override: draw a second arrow target -> source.
        if (relationship.direction === 'both') {
            this.drawArrowHead(
                arrow,
                renderer,
                targetX,
                targetY,
                sourceX,
                sourceY,
                0.80,
                fillColor,
                alpha
            );
        }

        arrow.zIndex = 2;
        arrow.alpha = 1;
    }

    private initializeLinkText(renderer: ObsidianRenderer, link: ObsidianLink, pairStatus: LinkPair): Text | null {
        let linkString: string | null = this.getMetadataKeyForLink(link.source.id, link.target.id);

        if (linkString === null) {
            return null;
        }

        const relationship = this.parseRelationshipKey(linkString);
        linkString = relationship.label;

        if (link.source.id === link.target.id) {
            linkString = '';
        }

        if (pairStatus === LinkPair.First) {
            linkString = linkString + '\n\n';
        } else if (pairStatus === LinkPair.Second) {
            linkString = '\n\n' + linkString;
        }

        const textStyle: TextStyle = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 36,
            fill: this.textColor
        });

        const text: Text = new Text(linkString, textStyle);

        text.zIndex = 1;
        text.anchor.set(0.5, 0.5);

        renderer.px.stage.addChild(text);

        return text;
    }

    private initializeLinkGraphics(renderer: ObsidianRenderer, link: ObsidianLink, tagLegend: boolean): Graphics | null {
        let linkString: string | null = this.getMetadataKeyForLink(link.source.id, link.target.id);

        if (linkString === null) {
            return null;
        }

        const relationship = this.parseRelationshipKey(linkString);
        linkString = relationship.label;

        let color = 0xffffff;

        if (link.source.id === link.target.id) {
            linkString = '';
        } else {
            if (!this.tagColors.has(linkString)) {
                color = this.categoricalColors[this.currentTagColorIndex];
                this.currentTagColorIndex = (this.currentTagColorIndex + 1) % this.categoricalColors.length;

                const textL = new Text(linkString, {
                    fontFamily: 'Arial',
                    fontSize: 14,
                    fill: this.textColor
                });

                textL.x = this.xOffset;
                textL.y = this.yOffset;
                renderer.px.stage.addChild(textL);

                const lineStartX = this.xOffset + textL.width + this.spaceBetweenTextAndLine;

                const graphicsL = new Graphics();
                graphicsL.lineStyle(2, color, 1);
                graphicsL.moveTo(lineStartX, this.yOffset + this.lineHeight / 2);
                graphicsL.lineTo(lineStartX + this.lineLength, this.yOffset + this.lineHeight / 2);
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
                    nUsing: 1,
                };

                this.tagColors.set(linkString, newLegendGraphic);
            } else {
                const legendGraphic = this.tagColors.get(linkString);

                if (legendGraphic) {
                    color = legendGraphic.color;
                    legendGraphic.nUsing += 1;
                }
            }
        }

        const graphics = new Graphics();
        graphics.lineStyle(3 / Math.sqrt(renderer.nodeScale), color);
        graphics.zIndex = 0;
        renderer.px.stage.addChild(graphics);

        return graphics;
    }

    private initializeLinkDirection(renderer: ObsidianRenderer, link: ObsidianLink): Graphics | null {
        const linkString = this.getMetadataKeyForLink(link.source.id, link.target.id);

        if (linkString === null || link.source.id === link.target.id) {
            return null;
        }

        const arrow = new Graphics();
        arrow.zIndex = 2;
        arrow.visible = false;
        renderer.px.stage.addChild(arrow);

        return arrow;
    }

    private drawArrowHead(
        graphics: Graphics,
        renderer: ObsidianRenderer,
        sourceX: number,
        sourceY: number,
        targetX: number,
        targetY: number,
        position: number,
        fillColor: number,
        alpha: number
    ): void {
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (!Number.isFinite(length) || length < 0.001) {
            return;
        }

        const ux = dx / length;
        const uy = dy / length;

        const arrowWorldX = sourceX + dx * position;
        const arrowWorldY = sourceY + dy * position;

        const { x: tipX, y: tipY } = this.getLinkToTextCoordinates(
            arrowWorldX,
            arrowWorldY,
            renderer.panX,
            renderer.panY,
            renderer.scale
        );

        const size = 10 / Math.sqrt(renderer.nodeScale);
        const width = 6 / Math.sqrt(renderer.nodeScale);

        const baseX = tipX - ux * size;
        const baseY = tipY - uy * size;

        const perpX = -uy;
        const perpY = ux;

        const leftX = baseX + perpX * width;
        const leftY = baseY + perpY * width;

        const rightX = baseX - perpX * width;
        const rightY = baseY - perpY * width;

        graphics.beginFill(fillColor, 0.9 * alpha);
        graphics.moveTo(tipX, tipY);
        graphics.lineTo(leftX, leftY);
        graphics.lineTo(rightX, rightY);
        graphics.lineTo(tipX, tipY);
        graphics.endFill();
    }

    private parseRelationshipKey(rawKey: string): ParsedRelationshipKey {
        const trimmed = rawKey.trim();

        if (trimmed.endsWith('__none')) {
            return {
                label: trimmed.slice(0, -'__none'.length).trim(),
                direction: 'none'
            };
        }

        if (trimmed.endsWith('__both')) {
            return {
                label: trimmed.slice(0, -'__both'.length).trim(),
                direction: 'both'
            };
        }

        return {
            label: trimmed,
            direction: 'default'
        };
    }

    private extractPathFromMarkdownLink(markdownLink: string | unknown): string {
        const links = extractLinks(markdownLink).links;
        return links.length > 0 ? links[0] : '';
    }

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

    destroyMap(renderer: ObsidianRenderer): void {
        if (this.linksMap.size > 0) {
            Array.from(this.linksMap.values()).forEach((gltLink) => {
                this.removeLink(renderer, gltLink.obsidianLink);
            });
        }
    }

    private getMetadataKeyForLink(sourceId: string, targetId: string): string | null {
        const sourcePage: any = this.api.page(sourceId);

        if (!sourcePage) {
            return null;
        }

        for (const [key, value] of Object.entries(sourcePage)) {
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
                    break;
            }
        }

        return null;
    }

    private getLinkToTextCoordinates(
        linkX: number,
        linkY: number,
        panX: number,
        panY: number,
        scale: number
    ): { x: number; y: number } {
        return {
            x: linkX * scale + panX,
            y: linkY * scale + panY
        };
    }

    private calculateNormal(sourceX: number, sourceY: number, targetX: number, targetY: number): { nx: number; ny: number } {
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;

        let nx = -dy;
        let ny = dx;

        const length = Math.sqrt(nx * nx + ny * ny);

        if (!Number.isFinite(length) || length < 0.001) {
            return { nx: 0, ny: 0 };
        }

        nx /= length;
        ny /= length;

        return { nx, ny };
    }

    private calculateParallel(sourceX: number, sourceY: number, targetX: number, targetY: number): { px: number; py: number } {
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;

        const length = Math.sqrt(dx * dx + dy * dy);

        if (!Number.isFinite(length) || length < 0.001) {
            return { px: 0, py: 0 };
        }

        return {
            px: dx / length,
            py: dy / length
        };
    }

    private getLinkAlpha(link: ObsidianLink): number {
        if (!link.source?.text || !link.target?.text || !link.source.text.alpha || !link.target.text.alpha) {
            return 0.9;
        }

        return Math.max(link.source.text.alpha, link.target.text.alpha);
    }

    private hexColorStringToNumber(color: string, fallback: number): number {
        if (!color) {
            return fallback;
        }

        const trimmed = color.trim();

        if (trimmed.startsWith('#')) {
            const parsed = Number.parseInt(trimmed.slice(1), 16);
            return Number.isFinite(parsed) ? parsed : fallback;
        }

        const rgbMatch = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

        if (rgbMatch) {
            const r = Number.parseInt(rgbMatch[1], 10);
            const g = Number.parseInt(rgbMatch[2], 10);
            const b = Number.parseInt(rgbMatch[3], 10);

            if ([r, g, b].every(n => Number.isFinite(n))) {
                return (r << 16) + (g << 8) + b;
            }
        }

        return fallback;
    }
}