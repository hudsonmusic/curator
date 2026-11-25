export const ACCENTS: { name: string; hex: string }[] = [
  { name: "Blue", hex: "#0a84ff" },
  { name: "Purple", hex: "#bf5af2" },
  { name: "Pink", hex: "#ff375f" },
  { name: "Red", hex: "#ff453a" },
  { name: "Orange", hex: "#ff9f0a" },
  { name: "Green", hex: "#30d158" },
  { name: "Teal", hex: "#40c8e0" },
  { name: "Graphite", hex: "#98989d" },
];

export const DEFAULT_ACCENT = ACCENTS[0].hex;

/** Black or white, whichever reads better on the accent. */
export function onAccent(hex: string): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return "#ffffff";
  const [r, g, b] = m.slice(1).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.4 ? "#111113" : "#ffffff";
}

export function applyAccent(hex: string) {
  const root = document.documentElement;
  root.style.setProperty("--color-accent", hex);
  root.style.setProperty("--color-onaccent", onAccent(hex));
}

/** Sets light or dark on the page ("system" follows macOS). */
export function applyTheme(pref: "system" | "dark" | "light") {
  const light = pref === "light" || (pref === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset.theme = light ? "light" : "dark";
}

/** Runs before first paint so the saved colour shows without a flash. */
export const ACCENT_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("curator:v1:profile")||"{}");var th=p.theme||"dark";document.documentElement.dataset.theme=th==="light"||(th==="system"&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";var h=p.accent;if(h&&/^#[0-9a-f]{6}$/i.test(h)){var m=h.slice(1).match(/../g).map(function(x){var c=parseInt(x,16)/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)});var L=0.2126*m[0]+0.7152*m[1]+0.0722*m[2];var r=document.documentElement;r.style.setProperty("--color-accent",h);r.style.setProperty("--color-onaccent",L>0.4?"#111113":"#ffffff")}}catch(e){}`;
