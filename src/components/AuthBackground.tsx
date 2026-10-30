import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

// A plain cream page that centres its content. No blobs, glow or blur.
function AuthBackground({ children }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      {children}
    </div>
  );
}

export default AuthBackground;
