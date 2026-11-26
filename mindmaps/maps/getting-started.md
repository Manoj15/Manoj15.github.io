---
title: Getting started
description: A tour of what a map can contain and how the toolbar works.
tags: [guide]
markmap:
  theme: studio
  colorFreezeLevel: 2
  initialExpandLevel: 2
---

# Mind Map Studio

## Writing maps
### Structure
- `# Title` is the root
- `## Heading` makes a main branch
- `### Heading` makes a sub-branch
- Bullets nest under any heading
  - Indent by 2 spaces
    - to go deeper
### Formatting
- **Bold**, *italic*, ~~strike~~, ==highlight==
- `inline code`
- [Links open in a new tab](https://markmap.js.org/)
- Math: $\sigma^2 = \frac{1}{n}\sum (x_i - \bar{x})^2$
- [ ] Open task
- [x] Done task
### Code blocks
- A block sits inside one node
  ```python
  def ctr(clicks, views):
      return clicks / views
  ```
### Front matter
- `title`, `description`, `tags` show in the gallery
- `markmap:` sets display options
  - `theme: studio` (or pastel, midnight, paper, mono, classic)
  - `colorFreezeLevel: 2` keeps one colour per main branch
  - `initialExpandLevel: 3` opens 3 levels at first
  - `maxWidth: 300` wraps long nodes

## Exploring
### Mouse
- Click a circle to fold or unfold
- Ctrl / ⌘ + click folds the whole branch
- Scroll to zoom, drag to pan
### Keys
- `F` fit · `+` / `−` zoom
- `0` expand all · `1`–`6` show that many levels
- `/` find a node, `Enter` for the next match
- `E` editor · `T` theme · `?` all shortcuts

## Themes
- **Theme** menu switches the look instantly
- Studio: dotted canvas, pastel branch cards
- Pastel: rounded pills on a soft gradient
- Midnight: glowing outlines on a dark grid
- Paper: serif ink on notebook lines
- Mono: black-and-white boxes
- Classic: bold branch pills and underlined details
- "Use the map's own theme" returns to the front matter choice

## Editing
- **Edit** opens a live Markdown editor beside the map
- Changes autosave as a local draft in your browser
- `Tab` / `Shift+Tab` indent and outdent bullets
- **Save to GitHub** opens a pre-filled commit page

## Sharing
- **Share link** packs the whole map into the URL
- **Export**
  - SVG and PNG images
  - Interactive HTML that works offline
  - The Markdown source

## Making maps with Claude
- Click **Copy Claude prompt** in the gallery
- Add your topic and paste it to Claude
- Claude writes `mindmaps/maps/<name>.md` and commits
- GitHub Pages redeploys and the map appears in the gallery
