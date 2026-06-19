/**
 * The domains the build ships. Importing this module registers every pack into
 * the shared {@link packRegistry}; both the main process (for prompts/tools) and
 * the renderer (for labels/forms) import it once at startup. The first pack
 * registered becomes the default for campaigns that don't name one.
 */
import { packRegistry } from '@shared/packRegistry'
import strainPack from './strain'
import batteryPack from './battery'

let registered = false

/** Register all built-in domain packs (idempotent). Order sets the default. */
export function registerDomainPacks(): void {
  if (registered) return
  packRegistry.register(strainPack) // flagship + default
  packRegistry.register(batteryPack)
  registered = true
}

// Register on import so a bare `import '@domains/index'` is enough.
registerDomainPacks()

export { packRegistry }
