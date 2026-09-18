# Portfolio templates

Published profiles share `ProfileDocument`, avatar modes, profile resolution, and RAG/chat behavior. Visual presentation belongs to a named portfolio template and must not import product-page styling.

The current template is `kinetic`. Its CSS lives beside the template boundary and is loaded only by the public-profile renderer. `portfolio-page` identifies a portfolio document; `portfolio-template-kinetic` is the template-specific root.

When another template is added:

1. Give it a distinct directory, root class, and stylesheet.
2. Register its stable identifier in `registry.ts`.
3. Load exactly one template stylesheet for a rendered profile.
4. Keep template choice outside `ProfileDocument`; the document remains portable professional data rather than a page-builder schema.
5. Reuse the existing profile, avatar, and chat behavior instead of copying those data/application boundaries into the template.

Template styles may define their own typography, colors, spacing, layout, and animation. They must not import `src/landing/landing.css`, onboarding styles, or other product UI styles. Product pages must likewise never import a portfolio-template stylesheet.
