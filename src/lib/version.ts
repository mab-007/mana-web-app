// App version label for the More / About footers. `__APP_VERSION__` is injected at
// build time from package.json by vite.config.ts (`define`). The web build has no
// native build number (unlike the EAS mobile build), so the label is version-only.
// `typeof` guard keeps it safe if the define is ever absent.
declare const __APP_VERSION__: string;

export const appVersion = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.1.0";
export const appVersionLabel = `Version • ${appVersion}`;
