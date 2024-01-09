# Graph Link Types for Obsidian

## Summary
Graph Link Types is a plugin for Obsidian.md that enhances the graph-view by rendering link types dynamically. This plugin leverages the Dataview API and PIXI.js to create a more informative and interactive graph experience. By displaying the types of links between notes, it provides a clearer understanding of the relationships within your Obsidian vault.

## Sample Vault Display
![Sample Vault Display](link-to-gif)

## Usage

To use the Graph Link Types plugin, ensure the [Dataview](https://blacksmithgu.github.io/obsidian-dataview/) plugin is installed in Obsidian. Then, simply add metadata with internal links to your notes using Dataview's syntax. Graph Link Types will render these links as text in the graph view.

In your note, add metadata like this:

```markdown
---
related: [[Research Document]]
---
```

Or inline:

```markdown
related:: [[Research Document]]
```

GraphLinkTypes will display "related" on the link in the graph view.

## Features
- Dynamically rendered link types in Obsidian's graph view.
- Custom text display for each link based on metadata.
- Efficient updating and rendering using PIXI.js.


## Development and Contributions
Interested in contributing to the development of GraphLinkTypes? Check out the [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin) for guidelines on how to develop a custom plugin for Obsidian.

## Milestone Goals
Stay updated with our progress and future plans by checking our [Milestone Goals](https://github.com/natefrisch01/Graph-Link-Types/milestones).

## Support the Project
If you enjoy using GraphLinkTypes and want to support its development, consider [buying me a coffee](https://www.buymeacoffee.com/natefrisch)! Your support helps in maintaining the project and exploring new ideas in community-driven coding.

<img src="https://github.com/natefrisch01/Graph-Link-Types/assets/44580969/b0b78ff4-c3a6-4614-8a35-efc3d475d8bf" alt="drawing" width="100"/>

