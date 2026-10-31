import { CircleNotch } from "@phosphor-icons/react";
import Brand from "./Brand";

function PageLoading() {
  return (
    <div
      role="status"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-cream p-4"
    >
      <Brand />
      <CircleNotch
        size={28}
        aria-hidden="true"
        className="animate-spin text-brand"
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default PageLoading;
