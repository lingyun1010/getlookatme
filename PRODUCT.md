# LookAtMe product

LookAtMe is an AI-native professional identity platform. It helps a professional turn a CV into an editable, interactive portfolio, then optionally add an original photo or mouse-follow avatar and a profile-grounded AI conversation.

## Target user

Professionals who want a richer and more explainable online identity than a static CV or conventional profile page.

## MVP direction

1. Upload a CV and review the structured professional profile.
2. Optionally add an original photo or generated avatar.
3. Publish an interactive portfolio under a LookAtMe profile URL.
4. Add a reusable directional avatar.
5. Let visitors ask questions grounded only in that profile.
6. Edit structured profile content.

## Portfolio Chat add-on

Chat is an optional capability that can be enabled across portfolio templates, not a feature of one visual design. It provides Quick Chat and a dedicated ephemeral multi-turn conversation through one profile-scoped, grounded API. Each template supplies presentation tokens so the shared add-on inherits its font, colors, spacing, controls, and content width without duplicating the template layout.

Both entry points display the same three-to-five profile-specific example questions stored in the resolved profile document. Questions are deterministically derived from the professional's actual projects, skills, experience, and education during profile creation, with the same fallback for legacy profiles. The Chat identity reuses the selected generated avatar's neutral center frame, then the existing profile photo or initials; Chat never generates a separate avatar asset.

## Future vision

Recruiter interaction analytics, company profiles, talent matching, and an AI-native professional network may follow after the core identity product is validated.

## M1.0 non-goals

Authentication, databases, uploads, an editor, multi-tenant RAG, analytics, billing, custom domains, employer profiles, matching, and network features are explicitly deferred.
