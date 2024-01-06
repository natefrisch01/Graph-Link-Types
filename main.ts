import { Plugin } from 'obsidian';
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
            9991159, 13948116, 16772608, 4280421, 16113345, 
            9474192, 4617584, 15790320, 12320668, 16185078, 
            32896, 15132410, 10040346, 16777128, 8388608, 
            11184895, 8421376, 16761035, 255, 8421504
        ];

        // Map each unique key to a color
        Array.from(uniqueKeys).forEach((key, index) => {
            const color = colors[index % colors.length]; // Cycle through colors
            this.keyColorMap.set(key, color);
        });

        console.log('Unique Metadata Keys with Link Values:');
        this.keyColorMap.forEach((color, key) => console.log(`${key}: ${color}`));
    }

    getColorForKey(key: string): number | undefined {
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
}
