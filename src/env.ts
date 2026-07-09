import type { Environment } from '@inkdropapp/types'

/**
 * The Environment passed to `activate()`. Held here so non-entry modules can
 * reach it without relying on the deprecated global `inkdrop`.
 */
let env: Environment | null = null

export function setEnv(e: Environment | null): void {
  env = e
}

export function getEnv(): Environment {
  if (!env) {
    throw new Error('ink-presentation: plugin is not activated')
  }
  return env
}
