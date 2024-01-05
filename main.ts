import { Plugin } from 'obsidian';
import { getAPI } from 'obsidian-dataview';

export default class UniqueMetadataKeysPlugin extends Plugin {
    api = getAPI();

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

        console.log('Unique Metadata Keys with Link Values:');
        uniqueKeys.forEach(key => console.log(key));
    }

    isLink(value: any): boolean {
        // Check if the value is a link object
        return typeof value === 'object' && value.hasOwnProperty('path');
    }
}

