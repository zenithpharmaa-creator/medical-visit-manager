export function shouldUseManagerSync(activatedDeviceExists: boolean, role?: "manager" | "representative") {
  return !activatedDeviceExists && role === "manager";
}
