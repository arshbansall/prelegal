# Prelegal frontend

The Next.js app for Prelegal. It is built as a static export (`out/`) that the FastAPI backend serves
at <http://localhost:8000> (see the root README for Docker).

Pages:

- `/login/`: placeholder sign-in. Any email and password is accepted by `POST /api/auth/login`.
- `/`: the Mutual NDA creator (PL-7). Fill in the key terms and the agreement updates live alongside
  the form; **Download PDF** generates the finished NDA in the browser.

Pages in the `src/app/(app)/` route group require sign-in and share the app shell (top bar with the
user's email and Sign out).

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000, proxies /api to the backend on :8000
```

Start the backend too (`cd ../backend && uv run uvicorn app.main:app --reload --port 8000`), or set
`PRELEGAL_API_ORIGIN` to point the dev proxy elsewhere.

| Command         | What it does                                  |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Start the dev server                          |
| `npm run build` | Static export to `out/` (served by FastAPI)   |
| `npm test`      | Run the Vitest unit tests                     |
| `npm run lint`  | Lint with ESLint                              |

## How it works

- **Sign-in** (`src/lib/session.ts`, `src/components/auth/`): the signed-in user is kept in
  localStorage and read through `useAuth()`. `RequireAuth` redirects signed-out visitors to `/login/`
  in the browser, since a static export has no server middleware. This is a placeholder, not security.
- **API calls** go through `src/lib/api.ts` using relative `/api/...` paths.
- **Styling** uses Tailwind with the brand palette defined as theme tokens in `src/app/globals.css`
  (`primary`, `secondary`, `accent`, `navy`, `muted`). Shared form controls live in
  `src/components/ui/fields.tsx`.
- **Templates** are read at build time from the repository's `templates/` directory
  (`Mutual-NDA-coverpage.md` and `Mutual-NDA.md`), so there is a single copy of the agreement text.
  See `src/lib/templates.ts`. Because the path is `../templates`, builds need the whole repository
  (the Dockerfile keeps this layout). Pages are prerendered, so the templates aren't needed at runtime.
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
