import type { SyntheticEvent } from "react";
import { settings } from "../config/settings";

function hideBroken(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

// The logo and the community name side by side. If logo.png is missing, the name still shows.
function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img
        src={settings.logo}
        alt=""
        onError={hideBroken}
        className="h-12 w-auto shrink-0 object-contain"
      />
      <p className="font-display text-lg font-semibold leading-tight text-ink">
        {settings.name}
      </p>
    </div>
  );
}

export default Brand;
