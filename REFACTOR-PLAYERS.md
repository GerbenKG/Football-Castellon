# Players DOM refactor

This branch moves the Players page into a dedicated `players-view.js` renderer.

The renderer owns the complete Players table, player edit/create modal, attendance history, archive/restore flow, skill level, bib counts, and member linking. The previous Players-specific DOM mutation scripts and inline MutationObserver have been removed from `index.html`.

The refactor intentionally keeps the existing vanilla JS and Supabase architecture. Dashboard and Games remain unchanged and are the next migration slices.
