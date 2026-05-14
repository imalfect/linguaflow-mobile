import { Resource } from "sst";

// Reads a config value, preferring plain process.env (local dev), falling back
// to SST's Resource proxy (Lambda runtime). Throws when nothing is found.
export function env(key: string): string {
  const direct = process.env[key];
  if (direct) return direct;
  try {
    const value = (Resource as unknown as Record<string, { value?: string } | undefined>)[key]?.value;
    if (value) return value;
  } catch {
    // Resource proxy throws when not running under SST. Ignore and fail below.
  }
  throw new Error(
    `Missing config: ${key}. Set it in .env (local dev) or via 'sst secret set ${key}' (deployed).`,
  );
}
