import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { getAPI } from 'obsidian-dataview';

export default class UniqueMetadataKeysPlugin extends Plugin {
    api = getAPI();
    keyColorMap = new Map<string, number>();

    onload() {
        this.addCommand({
            id: 'print-unique-metadata-keys',
            name: 'Print Unique Metadata Keys',
            callback: () => this.printUniqueMetadataKeys()
        });
        this.addCommand({
            id: 'print-graph-leaf',
            name: 'Print Graph Leaf',
            callback: () => this.findGraphLeaf()
        });
    }

    printUniqueMetadataKeys() {
        const allPages = this.api.pages('');
        const uniqueKeys = new Set<string>();

        for (const page of allPages) {
            for (const [key, value] of Object.entries(page)) {
                if (this.isLink(value)) {
                    uniqueKeys.add(key);
                }
            }
        }
        uniqueKeys.delete("file");

        // Define a list of categorical colors as single integers
        const colors = [
            16343842, 7260435, 11226103, 8810003, 1997538, 
            11796368, 9731429, 16177103, 15601550, 7601461, 
            1066150, 6197085, 5122908, 1339852, 2975129, 
            1364806, 3203221, 14122353, 7027020, 8280444
        ];

        // Map each unique key to a color
        Array.from(uniqueKeys).forEach((key, index) => {
            const color = colors[index % colors.length]; // Cycle through colors
            this.keyColorMap.set(key, color);
        });

        console.log('Unique Metadata Keys with Link Values:');
        this.keyColorMap.forEach((color, key) => console.log(`${key}: ${color}`));
    }

    getColorForKey(key: string | null): number | undefined {
        if (key === null) {
            return 0;
        }
        return this.keyColorMap.get(key);
    }

    getMetadataKeyForLink(sourceId: string, targetId: string): string | null {
        const sourcePage = this.api.page(sourceId);
        if (!sourcePage) {
            return null;
        }

        for (const [key, value] of Object.entries(sourcePage)) {
            if (this.isLink(value) && value.path === targetId) {
                return key;
            }
        }

        return null;
    }

    isLink(value: any): boolean {
        return typeof value === 'object' && value.hasOwnProperty('path');
    }

    findGraphLeaf(): WorkspaceLeaf | null{
        let graphLeaves = this.app.workspace.getLeavesOfType('graph');
		if (graphLeaves.length != 1) {
			if (graphLeaves.length < 1) {
				new Notice('No graph view open');
			} else {
				new Notice('More than one graph view open, please choose an active one');
			}
			return null;
		}
        const links = graphLeaves[0].view.renderer.links;
        
        for (let i = 0; i < 2; i++) {
            const sourceId = links[i].source.id;
            const targetId = links[i].target.id;
            console.log(sourceId);
            console.log(targetId);
            const linkKey = this.getMetadataKeyForLink(sourceId, targetId);
            const linkColor = this.getColorForKey(linkKey);
            console.log(linkColor);
            console.log(links[i].renderer);
            links[i].line._tintRGB = linkColor;
            links[i].renderer.colors.line.rgb = links[i].line._tintRGB;
            
        }

        
		return graphLeaves[0]
    }
}
