const root = document.documentElement;

root.style.setProperty("--snow-density", "1.35");
root.style.setProperty("--rain-density", "0.65");
root.style.setProperty("--rain-speed", "1.2s");

function setValue(name: string, value: string) {
  root.style.setProperty(name, value);
  try { localStorage.setItem(`glowcast-${name}`, value); } catch {}
}

function getValue(name: string, fallback: string) {
  try { return localStorage.getItem(`glowcast-${name}`) || fallback; } catch { return fallback; }
}

function buildSlider(label: string, cssVar: string, min: string, max: string, step: string, fallback: string) {
  const wrap = document.createElement("label");
  wrap.className = "effectControlSlider";
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.type = "range";
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = getValue(cssVar, fallback);
  setValue(cssVar, input.value);
  input.addEventListener("input", () => setValue(cssVar, input.value));
  wrap.append(span, input);
  return wrap;
}

function installEffectControls() {
  if (document.querySelector(".effectQuickControls")) return;
  const effectList = document.querySelector(".effectList");
  if (!effectList || !effectList.parentElement) return;

  const panel = document.createElement("div");
  panel.className = "effectQuickControls";

  const title = document.createElement("strong");
  title.textContent = "Effect intensity";

  panel.append(
    title,
    buildSlider("Snow amount", "--snow-density", "0.65", "2.25", "0.05", "1.35"),
    buildSlider("Rain amount", "--rain-density", "0.2", "1.2", "0.05", "0.65"),
    buildSlider("Rain speed", "--rain-speed-number", "0.65", "2.2", "0.05", "1.2")
  );

  const rainSpeedInput = panel.querySelector('input[type="range"]:last-child') as HTMLInputElement | null;
  rainSpeedInput?.addEventListener("input", () => setValue("--rain-speed", `${rainSpeedInput.value}s`));
  if (rainSpeedInput) setValue("--rain-speed", `${rainSpeedInput.value}s`);

  effectList.parentElement.appendChild(panel);
}

new MutationObserver(installEffectControls).observe(document.body, { childList: true, subtree: true });
window.addEventListener("DOMContentLoaded", installEffectControls);
installEffectControls();
