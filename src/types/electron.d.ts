/**
 * Minimal typing for the slice of Electron's renderer API the plugin
 * actually touches. The real `electron` module is provided by the Inkdrop
 * host at runtime (windows run with `nodeIntegration: true`); depending on
 * the `electron` package for types alone would add a huge devDependency for
 * two methods.
 */
declare module 'electron' {
  export const ipcRenderer: {
    send(channel: string, ...args: unknown[]): void
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
  }
}
