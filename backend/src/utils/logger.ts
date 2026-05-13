function formatMeta(meta?: object): string {
  if (!meta) {
    return "";
  }

  return ` ${JSON.stringify(meta)}`;
}

export function logStartup(step: string, meta?: object): void {
  console.log(`[startup] ${new Date().toISOString()} ${step}${formatMeta(meta)}`);
}
