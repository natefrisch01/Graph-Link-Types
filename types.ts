export interface CustomRenderer {
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

export interface CustomLink {
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

// Define the enum outside the class
export enum DataviewLinkType {
    WikiLink,
    MarkdownLink,
    String,
    Array,
    Other
}

// Define a numeric enum for link statuses
export enum LinkStatus {
    First,
    Second,
    None,
}
