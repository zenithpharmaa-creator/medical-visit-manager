export function resolveOAuthFrontendUrl(input: {
  host: string;
  protocol?: string;
  forwardedProto?: string;
  configuredUrl?: string;
}) {
  const configured = input.configuredUrl?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const protocol = (input.forwardedProto?.split(",")[0]?.trim() || input.protocol || "https").toLowerCase();
  const host = input.host.trim();
  const previewHost = host.replace(/^3000-/, "8081-");
  return `${protocol}://${previewHost}`;
}
