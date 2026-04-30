const root = document.documentElement;

root.style.setProperty("--snow-density", "1.35");
root.style.setProperty("--rain-density", "0.65");
root.style.setProperty("--rain-speed", "1.2s");
root.style.setProperty("--rain-lightning-enabled", "0");

function setValue(name: string, value: string) {
  root.style.setProperty(name, value);
  try { localStorage.setItem(`glowcast-${name}`, value); } catch {}
}

function getValue(name: string, fallback: string) {
  try { return localStorage.getItem(`glowcast-${name}`) || fallback; } catch { return fallback; }
}

function activeEffectName() {
  const active = document.querySelector(".effectList .activeEffect") as HTMLElement | null;
  return (active?.textContent || "").toLowerCase();
}

function syncVisibleControls() {
  const panel = document.querySelector(".effectQuickControls") as HTMLElement | null;
  if (!panel) return;
  const name = activeEffectName();
  panel.dataset.effect = name.includes("snow") ? "snow" : name.includes("rain") ? "rain" : name.includes("haunted") ? "haunt" : name.includes("fire") ? "fire" : name.includes("neon") ? "neon" : "none";
}

function buildSlider(label: string, cssVar: string, min: string, max: string, step: string, fallback: string, className: string, onInput?: (value: string) => void) {
  const wrap = document.createElement("label");
  wrap.className = `effectControlSlider ${className}`;
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.type = "range";
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = getValue(cssVar, fallback);
  setValue(cssVar, input.value);
  input.addEventListener("input", () => {
    setValue(cssVar, input.value);
    onInput?.(input.value);
  });
  wrap.append(span, input);
  return wrap;
}

function buildToggle(label: string, cssVar: string, fallback: string, className: string) {
  const wrap = document.createElement("label");
  wrap.className = `effectControlToggle ${className}`;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = getValue(cssVar, fallback) === "1";
  setValue(cssVar, input.checked ? "1" : "0");
  input.addEventListener("change", () => setValue(cssVar, input.checked ? "1" : "0"));
  const span = document.createElement("span");
  span.textContent = label;
  wrap.append(input, span);
  return wrap;
}

function installEffectControls() {
  const effectList = document.querySelector(".effectList");
  if (!effectList || !effectList.parentElement) return;

  let panel = document.querySelector(".effectQuickControls") as HTMLElement | null;
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "effectQuickControls";

    const title = document.createElement("strong");
    title.textContent = "Effect controls";

    panel.append(
      title,
      buildSlider("Snow amount", "--snow-density", "0.65", "2.35", "0.05", "1.35", "snowOnly"),
      buildSlider("Rain amount", "--rain-density", "0.2", "1.2", "0.05", "0.65", "rainOnly"),
      buildSlider("Rain speed", "--rain-speed-number", "0.65", "2.2", "0.05", "1.2", "rainOnly", (value) => setValue("--rain-speed", `${value}s`)),
      buildToggle("Occasional lightning flash", "--rain-lightning-enabled", "0", "rainOnly")
    );

    const rainSpeedInput = panel.querySelector('.rainOnly input[type="range"]:last-child') as HTMLInputElement | null;
    if (rainSpeedInput) setValue("--rain-speed", `${rainSpeedInput.value}s`);
    effectList.parentElement.appendChild(panel);
  }

  syncVisibleControls();
}

new MutationObserver(() => {
  installEffectControls();
  syncVisibleControls();
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
window.addEventListener("DOMContentLoaded", installEffectControls);
window.addEventListener("click", () => window.setTimeout(syncVisibleControls, 0));
installEffectControls();
