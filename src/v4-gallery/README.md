# V4 Gallery prototype

Open `/?prototype=v4-gallery` after running `npm run dev`.

This intentionally isolated prototype tests one question: can a stable 4:5 editorial overview, generated from a group of true image ratios, lead naturally to continuous single-image focus pages? It accepts 6–10 JPEG, PNG, or WebP files and starts with a generated mixed-ratio set. State is in memory only.

V4 owns all layout and visual code here. The only integration point outside this folder is the additive `prototype=v4-gallery` URL registration in `src/App.jsx`.
