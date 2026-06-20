/**
 * The domains the build ships. Importing this module registers every pack into
 * the shared {@link packRegistry}; both the main process (for prompts/tools) and
 * the renderer (for labels/forms) import it once at startup. The first pack
 * registered becomes the default for campaigns that don't name one.
 */
import { packRegistry } from '@shared/packRegistry'
import strainPack from './strain'
import proteinPack from './protein'
import moleculePack from './molecule'
import batteryPack from './battery'
import catalystPack from './catalyst'
import generalPack from './general'

let registered = false

/** Register all built-in domain packs (idempotent). Order sets the default. */
export function registerDomainPacks(): void {
  if (registered) return
  packRegistry.register(strainPack) // flagship + default
  packRegistry.register(proteinPack)
  packRegistry.register(moleculePack)
  packRegistry.register(batteryPack)
  packRegistry.register(catalystPack)
  packRegistry.register(generalPack) // domain-neutral catch-all
  registered = true
}

// Register on import so a bare `import '@domains/index'` is enough.
registerDomainPacks()

export { packRegistry }
