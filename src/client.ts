/**
 * Thin client for the local amaran BLE daemon (a "locally running npm package")
 * — the same HTTP surface that homebridge-amaran-lights' `http` transport
 * drives. See homebridge-amaran-lights/src/transports/httpTransport.ts.
 *
 * Unlike the Neewer plugin, amaran control is **stateless, absolute, and
 * action-pathed**:
 *
 *   POST /lights/:id/on
 *   POST /lights/:id/off
 *   POST /lights/:id/brightness   { value: 0-100 }
 *   POST /lights/:id/cct          { brightness: 0-100, kelvin, gm: 0 }
 *   POST /lights/:id/hsi          { brightness: 0-100, hue: 0-360, saturation: 0-100 }
 *
 * There is no toggle endpoint, no relative deltas, and no state read-back, so
 * the actions track on/level/kelvin locally in their own settings.
 *
 *   Stream Deck  ──HTTP──►  amaran BLE daemon  ──BLE──►  amaran light
 */

/** Connection settings shared by every action (stored per-action). */
export interface ConnectionSettings {
  baseUrl?: string;
  token?: string;
}

/** Default base URL of the amaran BLE daemon (matches the Homebridge schema placeholder). */
export const DEFAULT_BASE_URL = "http://127.0.0.1:2708";

export function baseUrlOf(settings: ConnectionSettings): string {
  const url = (settings.baseUrl ?? "").trim();
  return (url || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function headers(settings: ConnectionSettings, hasBody: boolean): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (hasBody) {
    h["Content-Type"] = "application/json";
  }
  if (settings.token) {
    h["Authorization"] = `Bearer ${settings.token}`;
  }
  return h;
}

/** POST to /lights/:id/:action with an optional JSON body. */
async function post(
  settings: ConnectionSettings,
  id: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<void> {
  const lightId = (id ?? "").trim();
  if (!lightId) {
    throw new Error("No Light ID set — enter the id from your Homebridge config.");
  }
  const url = `${baseUrlOf(settings)}/lights/${encodeURIComponent(lightId)}/${action}`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(settings, body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`POST /lights/${lightId}/${action} -> HTTP ${res.status}`);
  }
}

export function powerOn(settings: ConnectionSettings, id: string): Promise<void> {
  return post(settings, id, "on");
}

export function powerOff(settings: ConnectionSettings, id: string): Promise<void> {
  return post(settings, id, "off");
}

export function setBrightness(
  settings: ConnectionSettings,
  id: string,
  value: number,
): Promise<void> {
  return post(settings, id, "brightness", { value: clamp(value, 0, 100) });
}

export function setCct(
  settings: ConnectionSettings,
  id: string,
  brightness: number,
  kelvin: number,
): Promise<void> {
  return post(settings, id, "cct", {
    brightness: clamp(brightness, 0, 100),
    kelvin: Math.round(kelvin),
    gm: 0,
  });
}

export function setHsi(
  settings: ConnectionSettings,
  id: string,
  brightness: number,
  hue: number,
  saturation: number,
): Promise<void> {
  return post(settings, id, "hsi", {
    brightness: clamp(brightness, 0, 100),
    hue: clamp(hue, 0, 360),
    saturation: clamp(saturation, 0, 100),
  });
}
