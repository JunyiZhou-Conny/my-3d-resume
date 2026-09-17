# Run and verify the Conny comparison

## Start a preview

Use Node 24. Run these commands from the repository root.

```bash
cd web
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 3020 --strictPort
```

Open <http://localhost:3020>. The existing MeConny site runs independently on port 3018.

To develop with live reload, run `npm run dev -- --host 127.0.0.1 --port 3020 --strictPort` instead of the preview command.

## Rebuild the model

Keep the source MeConny checkout beside this repository. Use its prepared character and sticker assets from commit `3398a3be4d3f0b7f05d7751aadc0200f5fffa51f`. Run these commands from `web/`.

```bash
comparison_sources=$(mktemp -d)
git show c9a9fe373cde72c77ff7f2dabde17fb79dce89b3:web/public/models/me.glb > "$comparison_sources/upstream.glb"
node scripts/build-reference-scene.mjs \
	"$comparison_sources/upstream.glb" \
	../../MeConny/public/3d/conny-character.glb \
	../../MeConny/public/3d/stickers \
	"$comparison_sources/conny-reference.glb"
cmp "$comparison_sources/conny-reference.glb" public/models/me.glb
```

The composer writes a `.report.json` beside its output. It checks camera and focus transforms, animation bytes and targets, the static bind pose, geometry, material values, image bytes, and source preservation. The comparison exits successfully when the generated GLB matches the committed asset.

To change the model fit or sticker placement, edit `scripts/conny-scene.json` and repeat the export. Inspect the generated asset before copying it to `public/models/me.glb`.

## Verify the production page

Keep the preview running. Set `PLAYWRIGHT_MODULE` to the absolute path of an installed Playwright module. The verifier uses its Chrome channel. Run these commands from `web/`.

```bash
npm run lint
export PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs
COMPARISON_URL=http://localhost:3020 node scripts/verify-reference.mjs /tmp/conny-reference-verification
```

Read `results.json` in the output directory and inspect its desktop and phone screenshots. The verifier checks unchanged reference configuration, the served model, five scroll stops, character rotation, image loading, four project panels, repository links, modal dismissal, restored scrolling, and runtime errors.

The checks cover Chrome at 1440×900 and 390×844. They do not certify other browsers or measure frame rate.
