# Prelegal frontend

A Next.js prototype for creating a Common Paper Mutual Non-Disclosure Agreement (PL-7).

Fill in the key terms in a form and the completed agreement updates live alongside it. **Download PDF**
generates the finished NDA (cover page + standard terms) in the browser.

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
```

| Command         | What it does                         |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start the dev server                 |
| `npm run build` | Production build (prerenders `/`)    |
| `npm start`     | Serve the production build           |
| `npm test`      | Run the Vitest unit tests            |
| `npm run lint`  | Lint with ESLint                     |

## How it works

- **Templates** are read at build time from the repository's `templates/` directory
  (`Mutual-NDA-coverpage.md` and `Mutual-NDA.md`), so there is a single copy of the agreement text.
  See `src/lib/templates.ts`. Because the path is `../templates`, run builds from `frontend/` with the
  whole repository checked out (for example, on Vercel keep "Include files outside the Root Directory"
  enabled). The page is prerendered, so the templates are not needed at runtime.
- **Filling** happens in `src/lib/nda.ts`. `fillCoverPage` replaces the cover page's placeholders with
  the form values, keeps only the selected term options, and fills the party table. User input is escaped
  so it always renders as literal text. Blank fields keep the template's placeholder (e.g.
  `[Fill in state]`) so they can be completed by hand.
- **Preview** (`src/components/NdaPreview.tsx`) renders the filled Markdown to HTML with `marked`.
- **PDF** (`src/components/NdaPdfDocument.tsx`) walks the same `marked` tokens into
  `@react-pdf/renderer` components, producing a text-based (selectable, searchable) PDF. The renderer is
  loaded on demand when the user clicks **Download PDF**.

## Licensing

The agreement text is © Common Paper, used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
See `templates/LICENSE.txt`.
