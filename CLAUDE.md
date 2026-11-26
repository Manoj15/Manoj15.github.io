# CLAUDE.md

Personal site served by GitHub Pages from `master` (plain HTML, no Jekyll:
`.nojekyll` is required, do not remove it). Mind Map Studio lives in
`mindmaps/` and is published at https://manoj15.github.io/mindmaps/.

## Mind maps

When asked to create or update a mind map:

- Write it as Markdown at `mindmaps/maps/<kebab-case-name>.md`, following the
  format in `mindmaps/README.md` (front matter with `title`, `description`,
  `tags`, `markmap:` options; one `#` root, `##` branches, nested `-` bullets).
- Keep nodes short. Prefer 5 to 9 main branches with 3 to 6 children each.
  KaTeX `$math$`, `code`, links and fenced code blocks are supported.
- Run `python3 mindmaps/build_manifest.py` afterwards and commit both the new
  `.md` file and the updated `mindmaps/maps/index.json`.
- To check it renders: `cd mindmaps && python3 -m http.server 8000`, then open
  `http://localhost:8000/#/map/<name>`.
- Do not touch the rest of the site unless asked.
