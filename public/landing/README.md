# Landing demo assets

These files are stable, local copies of generated avatar outputs selected from the project owner's Supabase test environment on 2026-09-23. They intentionally exclude original uploads, CVs, account identifiers, private metadata, signed URLs, and storage paths.

- `people/`: generated center previews used only for the professional identity gallery. `ai-engineer.png` is copied from the repository's existing public Lingyun frame set.
- `interactive-demo/`: directional generated frames used by the bounded landing demo.
- `styles/`: generated previews for supported presentation variants of one test profile.

The production landing page must import these local files and must not depend on mutable test-account URLs.
