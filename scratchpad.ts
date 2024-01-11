
import { CustomLink } from './types';

class LinkManager {
    private linksMap: Map<string, CustomLink>;
    private linkStatus: Map<string, 'first' | 'second'>;

    constructor() {
        this.linksMap = new Map<string, CustomLink>();
        this.linkStatus = new Map<string, 'first' | 'second'>();
    }

    private generateKey(sourceId: string, targetId: string): string {
        return `${sourceId}-${targetId}`;
    }

    addLink(link: Link): void {
        const key = this.generateKey(link.source.id, link.target.id);
        const reverseKey = this.generateKey(link.target.id, link.source.id);

        // Add the new link
        this.linksMap.set(key, link);

        // Manage the pair statuses
        if (this.linksMap.has(reverseKey)) {
            // If the reverse link is already present, set the statuses accordingly
            this.linkStatus.set(key, 'second');
            this.linkStatus.set(reverseKey, 'first');
        } else {
            // If it's a standalone link (no pair yet), do not assign a pair status
            // This will be managed when the reverse link is added (if it happens)
        }
    }

    removeLink(link: Link): void {
        const key = this.generateKey(link.source.id, link.target.id);
        const reverseKey = this.generateKey(link.target.id, link.source.id);

        this.linksMap.delete(key);
        if (this.linkStatus.has(key)) {
            this.linkStatus.delete(key);
        }
        if (this.linkStatus.get(reverseKey) === 'second') {
            this.linkStatus.delete(reverseKey);
        }
    }

    updateLinks(currentLinks: Link[]): void {
        const currentKeys = new Set(currentLinks.map(link => this.generateKey(link.source.id, link.target.id)));
        for (const key of this.linksMap.keys()) {
            if (!currentKeys.has(key)) {
                const link = this.linksMap.get(key);
                if (link) {
                    this.removeLink(link);
                }
            }
        }
    }

    getLinkStatus(key: string): 'first' | 'second' | 'none' {
        return this.linkStatus.get(key) || 'none';
    }
}

// Example frames: Each frame is an array of links
const frames: Link[][] = [
    // Frame 1: Simple links, some will form pairs later
    [{ source: { id: "A" }, target: { id: "B" } },
     { source: { id: "C" }, target: { id: "D" } }],

    // Frame 2: Adding reverse links to form pairs and keeping existing links
    [{ source: { id: "A" }, target: { id: "B" } }, // Existing link
     { source: { id: "B" }, target: { id: "A" } }, // Forms a pair with Frame 1's A-B
     { source: { id: "C" }, target: { id: "D" } }, // Existing link
     { source: { id: "E" }, target: { id: "F" } }], // New link

    // Frame 3: Keeping a pair, removing a single link, adding a new link
    [{ source: { id: "A" }, target: { id: "B" } }, // Existing link
     { source: { id: "B" }, target: { id: "A" } }, // Existing pair
     { source: { id: "G" }, target: { id: "H" } }], // New link

    // Frame 4: 
    [{ source: { id: "B" }, target: { id: "A" } },
     { source: { id: "G" }, target: { id: "H" } }], // New link
];

const linkManager = new LinkManager();

frames.forEach((frame, frameIndex) => {
    console.log(`Frame ${frameIndex + 1}:`);

    // Update link manager with the current frame's links
    linkManager.updateLinks(frame);

    // Process links
    frame.forEach(link => {
        const key = linkManager.generateKey(link.source.id, link.target.id);
        if (!linkManager.linksMap.has(key)) {
            linkManager.addLink(link);
        }
        const status = linkManager.getLinkStatus(key);

        // Print link status
        if (status === 'first') {
            console.log('\n' + key);
        } else if (status === 'second') {
            console.log(key + '\n');
        } else {
            console.log(key); // Not part of a pair
        }
    });
});
