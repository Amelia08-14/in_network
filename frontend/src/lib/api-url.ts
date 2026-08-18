const LOCAL_API_URL = 'http://localhost:4000';
const PRODUCTION_API_URL = 'https://api.in-network.dz';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? LOCAL_API_URL;

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * Prevent a production visitor from calling port 4000 on their own device.
 * NEXT_PUBLIC_* values are frozen into the browser bundle at build time, so a
 * build accidentally produced with the development .env would otherwise make
 * every client-side API call fail outside the developer's computer.
 */
export function getClientApiUrl() {
  if (
    typeof window !== 'undefined' &&
    !isLocalHostname(window.location.hostname) &&
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(configuredApiUrl)
  ) {
    return PRODUCTION_API_URL;
  }

  return configuredApiUrl;
}

