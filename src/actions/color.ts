import streamdeck, {
  action,
  KeyAction,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { setHsi, ConnectionSettings } from "../client";
import { setLevelSync } from "../state";

interface ColorSettings extends ConnectionSettings {
  lightId?: string;
  /** Target colour as a hex string, e.g. "#ff3366". */
  color?: string;
  /** Brightness used when sending the colour (0-100). */
  level?: number;
}

const DEFAULT_COLOR = "#ffffff";

/** Convert a hex colour to amaran's hue (0-360) + saturation (0-100). */
function hexToHueSat(hex: string): { hue: number; saturation: number } {
  const normalized = String(hex).replace("#", "").trim();
  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  if (hue < 0) {
    hue += 360;
  }

  const saturation = max === 0 ? 0 : delta / max;

  return { hue: Math.round(hue), saturation: Math.round(saturation * 100) };
}

function swatchSvg(color: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">` +
    `<circle cx="36" cy="36" r="22" fill="${color}" stroke="#ffffff" stroke-width="3"/>` +
    `</svg>`
  );
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

@action({ UUID: "com.coachjamesgunaca.amaran-openapi.color" })
export class ColorKey extends SingletonAction<ColorSettings> {
  override async onWillAppear(ev: WillAppearEvent<ColorSettings>): Promise<void> {
    if (ev.action.isKey()) {
      await this.paint(ev.action, ev.payload.settings.color ?? DEFAULT_COLOR);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<ColorSettings>): Promise<void> {
    const settings = ev.payload.settings;
    const color = settings.color ?? DEFAULT_COLOR;
    const brightness = settings.level ?? 100;
    const { hue, saturation } = hexToHueSat(color);

    try {
      await setHsi(settings, settings.lightId ?? "", brightness, hue, saturation);
      setLevelSync(settings.lightId ?? "", brightness);
      if (ev.action.isKey()) {
        await this.paint(ev.action, color);
      }
    } catch (err) {
      streamdeck.logger.warn(`color failed: ${err instanceof Error ? err.message : err}`);
      await ev.action.showAlert();
    }
  }

  private async paint(keyAction: KeyAction<ColorSettings>, color: string): Promise<void> {
    await keyAction.setImage(svgDataUri(swatchSvg(color)));
  }
}
