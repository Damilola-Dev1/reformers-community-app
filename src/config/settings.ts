// src/config/settings.ts
// One place for the community's identity. A new community changes the values
// below and nothing else: the palette is written onto :root when the app starts,
// and Tailwind colour names such as bg-brand read those variables.

export const settings = {
  communityId: "reformers-nation",
  name: "The Reformers Nation",
  appName: "Reformers Community Hub",
  logo: "/logo.png",
  theme: {
    brand: "#7A1E2E", // buttons, active nav, links. Replace with the exact maroon sampled from the logo.
    brandDark: "#5E1522", // hover and pressed
    brandTint: "#F4E8EA", // avatars, selected rows
    cream: "#FAF7F2", // page background
    line: "#E8E0D6", // borders and dividers
    ink: "#1F1A1A", // body text
    muted: "#5F5757", // secondary text
    teal: "#1F5A5E", // second chart series
    gold: "#B8893B", // thin rules only, never text
    ok: "#14612F",
    okBg: "#E7F4EA",
    warn: "#8A4308",
    warnBg: "#FBF0E0",
    danger: "#B91C1C",
    dangerBg: "#FBEAEA",
  },
};

type ThemeKey = keyof typeof settings.theme;

// brandDark -> --brand-dark
function toCssName(key: string): string {
  return "--" + key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
}

export function applyTheme(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const keys = Object.keys(settings.theme) as ThemeKey[];
  keys.forEach((key) => {
    root.style.setProperty(toCssName(key), settings.theme[key]);
  });
}

// Runs once when this file is first imported. index.css holds the same values
// as a fallback, so the first paint is already on-brand.
applyTheme();
