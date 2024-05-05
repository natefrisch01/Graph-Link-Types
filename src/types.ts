import { Text , Graphics}  from 'pixi.js';

export interface ObsidianRenderer {
    px: {
        stage: {
            sortableChildren: boolean;
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

export interface ObsidianLink {
    source: {
        id: string;
        x: number;
        y: number;
        weight: number;
        text: {
            alpha: number;
        }
    };
    target: {
        id: string;
        x: number;
        y: number;
        weight: number;
        text: {
            alpha: number;
        }
    };
}

// Define the enum outside the class
export enum DataviewLinkType {
    WikiLink,
    MarkdownLink,
    String,
    Array,
    Other
}

// Define a numeric enum for link statuses
export enum LinkPair {
    None,
    First,
    Second,
}

export interface GltLink {
    obsidianLink: ObsidianLink;
    pairStatus: LinkPair;
    pixiText: Text | null;
    pixiGraphics: Graphics | null;
}

export interface GltLegendGraphic {
    color: number;
    legendText: Text;
    legendGraphics: Graphics;
    nUsing: number;
}
