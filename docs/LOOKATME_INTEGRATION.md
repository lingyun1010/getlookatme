# LookAtMe integration

## Scope

This milestone integrates the external `lookatme-avatar` SDK into the real onboarding flow and the existing portfolio hero. It does not introduce a temporary demo page, a separate LookAtMe server, or a second avatar section. The work stays inside the current getlookatme app.

## Product flow

1. User uploads a CV and a portrait photo during onboarding.
2. The user selects either `Use original photo` or `Generate dynamic avatar`.
3. Original-photo mode stores the uploaded image as the portfolio hero avatar and behaves like a normal static image.
4. The onboarding preview keeps the uploaded original photo in a square crop, while the generated avatar preview uses pointer-following motion rather than timed autoplay.
5. Dynamic-avatar mode sends the portrait to the getlookatme-owned API route for generation.
6. The server route uses the external SDK's `PhotoAIFrameProducer` and `OpenAIImageGenerationProvider` with the `smooth` preset.
7. The resulting `AvatarFrameSet` passes through the SDK's local store, is copied to owner-scoped Supabase Storage, and is applied to the hero avatar slot.

## Server boundary

Browser code imports only React and `lookatme-avatar/react` for rendering. The generation pipeline stays server-side:

```ts
import {
  PhotoAIFrameProducer,
  OpenAIImageGenerationProvider,
} from "lookatme-avatar/server";
```

The server uses the app-owned `OPENAI_API_KEY` from the getlookatme environment; it never depends on a LookAtMe demo server or a browser API call to OpenAI.

## Storage

Generated frame sets currently pass through a temporary local folder behind the SDK abstraction. The authenticated browser then uploads each frame to `profile-public-assets/<user_id>/<profile_id>/avatar-frames/...`; Storage RLS verifies both ownership components, and the durable URLs are persisted with the private onboarding state. Original photos remain in `profile-private-assets` and use owner-authorized signed URLs for previews. Direct-to-object-storage generation and cleanup of replaced assets remain deferred.

## UI contract

The semantic profile state intentionally keeps product terms, not implementation-specific frame counts:

```ts
avatarMode: "original" | "dynamic";
avatarPreset?: "smooth";
avatarImageUrl?: string;
avatarFrameSet?: AvatarFrameSet;
```

The app keeps this state on the profile while mapping it into the renderer's existing avatar contract. The hero uses the same position and layout; only the source of the avatar changes.

## Remaining production work

- Replace temporary local storage with project-owned cloud/object storage.
- Add a permanent profile persistence layer for user avatars.
- Add stricter cleanup and lifecycle controls for generated assets.
- Consider a background queue if generation becomes asynchronous.
- Add end-to-end browser validation for hero rendering and API responses.

## Handoff

The integration is intentionally scoped to the current app and should remain easy to replace. The generation route, the onboarding state, and the hero renderer should continue to be the only places that know about dynamic avatar generation. Any future production architecture can swap the storage backend and server provider without changing the product semantics of `avatarMode`.
