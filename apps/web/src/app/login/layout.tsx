import type { ReactNode } from "react";
import { LoginDeviceProvider } from "./login-device-context";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <LoginDeviceProvider>{children}</LoginDeviceProvider>;
}
