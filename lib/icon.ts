/** curator's icon: a record on a dark tile, its label in the accent colour. */
export function iconSvg(accent: string, size = 64) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
<rect width="64" height="64" rx="15" fill="#141416"/>
<circle cx="32" cy="32" r="27" fill="#050506"/>
<circle cx="32" cy="32" r="23.5" fill="none" stroke="#ffffff" stroke-opacity=".09" stroke-width="1.2"/>
<circle cx="32" cy="32" r="20" fill="none" stroke="#ffffff" stroke-opacity=".09" stroke-width="1.2"/>
<path d="M11.5 24.5A22 22 0 0 1 24.5 11.5" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="2.2" stroke-linecap="round"/>
<circle cx="32" cy="32" r="13.5" fill="${accent}"/>
<circle cx="32" cy="32" r="3.2" fill="#141416"/>
</svg>`;
}

export const iconDataUrl = (accent: string) => `data:image/svg+xml,${encodeURIComponent(iconSvg(accent))}`;
