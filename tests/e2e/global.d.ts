export {};

declare global {
  interface Window {
    __TIGER__?: Record<string, unknown>;
  }
}
