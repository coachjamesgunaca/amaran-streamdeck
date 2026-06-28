import streamdeck, {
  action,
  DialAction,
  DialDownEvent,
  DialRotateEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";
import { powerOff, powerOn, setCct, clamp, ConnectionSettings } from "../client";
import { coalescerFor, getLevelSync, hydrateLevels } from "../state";

/** Amber -> sky-blue gradient for the touch-strip bar (warm to cool). */
const CCT_GRADIENT = "0:#ea8f2f,1:#5bcaff";
const MIN_KELVIN = 2000;
const MAX_KELVIN = 10000;

interface CctDialSettings extends ConnectionSettings {
  lightId?: string;
  /** Kelvin per dial tick. */
  perTick?: number;
  kelvin?: number;
  level?: number;
  isOn?: boolean;
}

/** Live colour-temperature per dial instance, so fast spins accumulate synchronously. */
const kelvinByContext = new Map<string, number>();

@action({ UUID: "com.coachjamesgunaca.amaran-openapi.cct-dial" })
export class CctDial extends SingletonAction<CctDialSettings> {
  override async onWillAppear(ev: WillAppearEvent<CctDialSettings>): Promise<void> {
    if (!ev.action.isDial()) {
      return;
    }
    await hydrateLevels();
    kelvinByContext.set(ev.action.id, ev.payload.settings.kelvin ?? 5600);
    await ev.action.setFeedbackLayout("$B2");
    await this.render(ev.action, ev.payload.settings);
  }

  override async onDialRotate(ev: DialRotateEvent<CctDialSettings>): Promise<void> {
    const settings = ev.payload.settings;
    const id = settings.lightId ?? "";
    const perTick = settings.perTick && settings.perTick > 0 ? settings.perTick : 100;
    const currentK = kelvinByContext.get(ev.action.id) ?? settings.kelvin ?? 5600;
    const kelvin = clamp(currentK + ev.payload.ticks * perTick, MIN_KELVIN, MAX_KELVIN);

    // Update local state + dial display immediately (no awaiting HTTP).
    kelvinByContext.set(ev.action.id, kelvin);
    settings.kelvin = kelvin;
    settings.isOn = true;
    await this.render(ev.action, settings);
    void ev.action.setSettings(settings);

    // Coalesce the command; preserve the light's last-set brightness.
    coalescerFor(ev.action.id).run(async () => {
      const brightness = getLevelSync(id) ?? settings.level ?? 100;
      try {
        await setCct(settings, id, brightness, kelvinByContext.get(ev.action.id) ?? kelvin);
      } catch (err) {
        streamdeck.logger.warn(`cct-dial send failed: ${err instanceof Error ? err.message : err}`);
        await ev.action.showAlert();
      }
    });
  }

  override async onDialDown(ev: DialDownEvent<CctDialSettings>): Promise<void> {
    const settings = ev.payload.settings;
    const turnOn = !(settings.isOn ?? false);

    try {
      if (turnOn) {
        await powerOn(settings, settings.lightId ?? "");
      } else {
        await powerOff(settings, settings.lightId ?? "");
      }
      settings.isOn = turnOn;
      await ev.action.setSettings(settings);
      await this.render(ev.action, settings);
    } catch (err) {
      streamdeck.logger.warn(`cct-dial press failed: ${err instanceof Error ? err.message : err}`);
      await ev.action.showAlert();
    }
  }

  private async render(
    actionInstance: DialAction<CctDialSettings>,
    settings: CctDialSettings,
  ): Promise<void> {
    const kelvin = settings.kelvin ?? 5600;
    const on = settings.isOn ?? false;
    const percent = Math.round(((kelvin - MIN_KELVIN) / (MAX_KELVIN - MIN_KELVIN)) * 100);
    await actionInstance.setFeedback({
      title: "Color Temp",
      value: on ? `${kelvin}K` : "Off",
      indicator: {
        value: on ? Math.max(0, Math.min(100, percent)) : 0,
        bar_bg_c: CCT_GRADIENT,
      },
    });
  }
}
