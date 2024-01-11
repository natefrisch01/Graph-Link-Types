
import { CustomLink, LinkStatus } from 'types';

export class LinkManager {
    linksMap: Map<string, CustomLink>;
    linkStatus: Map<string, LinkStatus.First | LinkStatus.Second>;

    constructor() {
        this.linksMap = new Map<string, CustomLink>();
        this.linkStatus = new Map<string, LinkStatus.First | LinkStatus.Second>();
    }

    generateKey(sourceId: string, targetId: string): string {
        return `${sourceId}-${targetId}`;
    }

    addLink(link: CustomLink): void {
        const key = this.generateKey(link.source.id, link.target.id);
        const reverseKey = this.generateKey(link.target.id, link.source.id);

        // Add the new link
        this.linksMap.set(key, link);

        // Manage the pair statuses
        if (this.linksMap.has(reverseKey)) {
            // If the reverse link is already present, set the statuses accordingly
            this.linkStatus.set(key, LinkStatus.Second);
            this.linkStatus.set(reverseKey, LinkStatus.First);
        } else {
            // If it's a standalone link (no pair yet), do not assign a pair status
            // This will be managed when the reverse link is added (if it happens)
        }
    }

    removeLink(link: CustomLink): void {
        const key = this.generateKey(link.source.id, link.target.id);
        const reverseKey = this.generateKey(link.target.id, link.source.id);

        this.linksMap.delete(key);
        if (this.linkStatus.has(key)) {
            this.linkStatus.delete(key);
        }
        if (this.linkStatus.get(reverseKey) === LinkStatus.Second) {
            this.linkStatus.delete(reverseKey);
        }
    }

    updateLinks(currentLinks: CustomLink[]): void {
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

    getLinkStatus(key: string): LinkStatus {
        const status = this.linkStatus.get(key)
        if (status !== undefined) {
            return status
        } else{
            return LinkStatus.None
        }
    }
}