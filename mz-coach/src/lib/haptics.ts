// Haptisches Feedback.
// iOS Safari kennt navigator.vibrate nicht. Ab iOS 18 löst das Umschalten eines
// <input type="checkbox" switch> aber ein kurzes Tippen der Taptic Engine aus.
// Das wird hier über ein unsichtbares Element genutzt. Auf anderen Geräten
// greift navigator.vibrate, sonst passiert einfach nichts.

let label: HTMLLabelElement | null = null;

function ensureSwitch(): HTMLLabelElement {
  if (label) return label;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.id = "haptic-switch";
  label = document.createElement("label");
  label.htmlFor = input.id;
  for (const el of [input, label]) {
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9px;top:-9px";
  }
  document.body.append(input, label);
  return label;
}

export function haptic() {
  if (typeof window === "undefined") return;
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(8);
    return;
  }
  try {
    ensureSwitch().click();
  } catch {
    // ohne Haptik weiter
  }
}
