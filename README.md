# streamdeck-amaran-lights

A Stream Deck plugin to control amaran lights — **without the amaran Desktop app running** — by talking to your local **amaran BLE daemon** (the same npm package that [`homebridge-amaran-lights`](https://github.com/coachjamesgunaca/homebridge-amaran-lights) drives through its `http` transport).

This is the successor to the original OpenAPI build. Instead of speaking the amaran Desktop OpenAPI (AES-token WebSocket) directly, the plugin now sends simple HTTP commands.

By default it points at the **homebridge-amaran-lights HTTP control server** (port `2709`), which forwards to the daemon *and* keeps HomeKit in sync — the way the Neewer setup behaves:

```
Stream Deck ──HTTP──► homebridge-amaran-lights (:2709) ──► amaran daemon (:2708) ──► light
                              └── updates HomeKit
```

You can instead point the **Server** field straight at the daemon (`http://127.0.0.1:2708`) for direct control, but then changes won't show in HomeKit. The control server is part of homebridge-amaran-lights (enable `http` in its config).

## How amaran control differs from the Neewer plugin

The Neewer daemon takes a single `POST /lights/:id` with relative fields
(`toggle`, `brightnessDelta`, …) and reports state back. The amaran daemon is
**stateless, absolute, and action-pathed** — there is no toggle endpoint, no
deltas, and no state read-back:

| Method | Path | Body |
| --- | --- | --- |
| POST | `/lights/:id/on` | — |
| POST | `/lights/:id/off` | — |
| POST | `/lights/:id/brightness` | `{ "value": 0-100 }` |
| POST | `/lights/:id/cct` | `{ "brightness": 0-100, "kelvin": <K>, "gm": 0 }` |
| POST | `/lights/:id/hsi` | `{ "brightness": 0-100, "hue": 0-360, "saturation": 0-100 }` |

Because the daemon never reports state, each action remembers its own
on/brightness/kelvin in its Stream Deck settings and adjusts from there. (This
matches `homebridge-amaran-lights/src/transports/httpTransport.ts`.)

## Prerequisites

1. Your amaran BLE daemon running locally and reachable over HTTP (default
   `http://127.0.0.1:2708`). This is the same service `homebridge-amaran-lights`
   points its `http` transport at:

   ```json
   {
     "platform": "AmaranLightsPlatform",
     "transport": {
       "type": "http",
       "baseUrl": "http://127.0.0.1:2708/"
     },
     "lights": [
       { "id": "05010-ccdde1", "name": "Ray 120c", "model": "ray-120c" }
     ]
   }
   ```

2. [Node.js 20+](https://nodejs.org) and the [Stream Deck app](https://www.elgato.com/downloads) 6.5+.
3. A Stream Deck + if you want the dial actions (keys work on any model).

## Actions

| Action | Controller | Behavior |
| --- | --- | --- |
| **Toggle / On / Off** | Key | Toggles a light, or forces on/off (configurable). |
| **Brightness Step** | Key | Adjusts brightness by a fixed step per press (negative = down). |
| **Color** | Key | Sets a colour (hue/saturation) on colour-capable lights (e.g. Ray 120c). |
| **Brightness Dial** | Dial | Rotate to change brightness; press to toggle. Touch strip shows level. |
| **Color Temp Dial** | Dial | Rotate to change color temperature; press to toggle. |

Each action's Property Inspector takes the target **Light ID** (the `id` from
your Homebridge/daemon config), the step/per-tick amount, and the server
URL/token.

## Build & install

The plugin ships with [`bin/plugin.js`](bin/plugin.js) already built, so it runs
as-is. To rebuild after changing the TypeScript source:

```bash
npm install
npm run build
```

Then link it into Stream Deck using the [Elgato CLI](https://docs.elgato.com/streamdeck/cli/intro):

```bash
npm install -g @elgato/cli
streamdeck link com.coachjamesgunaca.amaran-openapi.sdPlugin
streamdeck restart com.coachjamesgunaca.amaran-openapi
```

For a manual/local install, copy the `com.coachjamesgunaca.amaran-openapi.sdPlugin`
folder into `~/Library/Application Support/com.elgato.StreamDeck/Plugins/` and
relaunch Stream Deck. During development, `npm run watch` rebuilds on change.

The actions appear under the **Amaran Lights** category.

## Configuration

- **Light ID** — the `id` of the light in your Homebridge/daemon config (e.g. `05010-ccdde1`).
- **Server** — amaran BLE daemon base URL (default `http://127.0.0.1:2708`).
- **Token** — only if your daemon requires a bearer token.
- **Mode / Color / Brightness / Step / Per tick** — action-specific behaviour.

## Notes

- Since the daemon has no state read-back, the on/off and brightness/kelvin a
  dial shows are what the **plugin** last sent — if you change a light elsewhere,
  the next press/rotate re-asserts the plugin's remembered value.
- The daemon contract has no "all lights" or device-list endpoint, so the Light
  ID is entered manually per action.
- Icons are simple SVGs in `imgs/`; replace with your own art before publishing.
- The plugin UUID stays `com.coachjamesgunaca.amaran-openapi` to match the
  existing `.sdPlugin` folder name. Rename both together for a tidier id.

## License

MIT
