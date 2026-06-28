import streamdeck from "@elgato/streamdeck";

import { ToggleLight } from "./actions/toggle";
import { BrightnessStep } from "./actions/brightness-step";
import { BrightnessDial } from "./actions/brightness-dial";
import { CctDial } from "./actions/cct-dial";
import { ColorKey } from "./actions/color";

streamdeck.actions.registerAction(new ToggleLight());
streamdeck.actions.registerAction(new BrightnessStep());
streamdeck.actions.registerAction(new BrightnessDial());
streamdeck.actions.registerAction(new CctDial());
streamdeck.actions.registerAction(new ColorKey());

streamdeck.connect();
