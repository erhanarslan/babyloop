import { ImageResponse } from "next/og";

export const alt = "BabyLoop parent marketplace";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #fff7ed 0%, #ecfeff 52%, #eef2ff 100%)",
          color: "#172554",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%"
        }}
      >
        <div
          style={{
            background: "#172554",
            borderRadius: "999px",
            color: "#ffffff",
            display: "flex",
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            marginBottom: 36,
            padding: "20px 32px"
          }}
        >
          BabyLoop
        </div>
        <div
          style={{
            fontSize: 78,
            fontWeight: 800,
            letterSpacing: "-0.055em",
            lineHeight: 1.02,
            maxWidth: 920,
            textAlign: "center"
          }}
        >
          Reuse baby essentials with trusted parent guidance
        </div>
        <div
          style={{
            color: "#475569",
            fontSize: 30,
            lineHeight: 1.35,
            marginTop: 30,
            maxWidth: 820,
            textAlign: "center"
          }}
        >
          Buy, sell, donate, message safely, and plan age-band needs with BabyLoop.
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}
