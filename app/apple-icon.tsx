import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the record, drawn for iOS. */
export default function AppleIcon() {
  const ring = (d: number, extra: Record<string, string | number> = {}) => ({
    position: "absolute" as const,
    width: d,
    height: d,
    left: (180 - d) / 2,
    top: (180 - d) / 2,
    borderRadius: "50%",
    ...extra,
  });
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, background: "#141416", display: "flex", position: "relative" }}>
        <div style={ring(152, { background: "#050506" })} />
        <div style={ring(132, { border: "3px solid rgba(255,255,255,0.09)" })} />
        <div style={ring(112, { border: "3px solid rgba(255,255,255,0.09)" })} />
        <div style={ring(76, { background: "#0a84ff" })} />
        <div style={ring(18, { background: "#141416" })} />
      </div>
    ),
    size,
  );
}
