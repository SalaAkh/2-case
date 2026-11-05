# Zero-Spoiler on Sites

This directory adapts the working Next.js MVP to the supported Sites Vinext runtime. The canonical application lives in `../src`; synchronize it with `node ../scripts/sync-cloud-site.mjs` from this directory before building. Keep the maintained Sites plugins and Worker entrypoint.

Install with npm, then use the Sites skill's build and source workflow helpers. `npm run build` also runs the local Vinext build. Dependencies include Monaco; postinstall copies its assets locally. `.openai/hosting.json` contains the existing private Site identity. Reuse it instead of creating another Site.

No OpenAI key is bundled. The deployed default is an explicitly labeled scripted demonstration. Add `OPENAI_API_KEY` as a server runtime secret and optionally `OPENAI_MODEL` for live analysis. Never add keys to Git or browser code.

The root Next.js project remains available for ordinary Node hosting. Session history stays in each browser's localStorage and does not synchronize across devices.
