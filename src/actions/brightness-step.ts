import streamdeck, { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { setBrightness, clamp, ConnectionSettings } from "../client";
import { getLevelSync, hydrateLevels, setLevelSync } from "../state";

interface StepSettings extends ConnectionSettings {
  lightId?: string;
  /** Percentage points per press; negative steps brightness down. */
  step?: number;
  /** Cached brightness level (the daemon offers no read-back). */
  level?: number;
}

@action({ UUID: "com.coachjamesgunaca.amaran-openapi.brightness-step" })
export class BrightnessStep extends SingletonAction<StepSettings> {
  override async onKeyDown(ev: KeyDownEvent<StepSettings>): Promise<void> {
    const settings = ev.payload.settings;
    const id = settings.lightId ?? "";
    await hydrateLevels();
    const step = typeof settings.step === "number" && settings.step !== 0 ? settings.step : 10;
    const level = clamp((getLevelSync(id) ?? settings.level ?? 50) + step, 0, 100);

    try {
      await setBrightness(settings, id, level);
      settings.level = level;
      setLevelSync(id, level);
      await ev.action.setSettings(settings);
      await ev.action.setTitle(`${level}%`);
    } catch (err) {
      streamdeck.logger.warn(`brightness-step failed: ${err instanceof Error ? err.message : err}`);
      await ev.action.showAlert();
    }
  }
}
