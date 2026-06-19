/**
 * Domain-pack registry. A tiny in-memory map shared by both processes: the main
 * process registers packs at engine boot (for prompts/tools) and the renderer
 * registers the same dependency-free pack modules at startup (for labels/forms).
 *
 * Packs are registered explicitly from `src/domains/index.ts` so there is a
 * single, auditable list of the domains the build ships.
 */
import type { DomainPack, DomainPackRegistry } from './domainpack'

class Registry implements DomainPackRegistry {
  private packs = new Map<string, DomainPack>()
  private firstId: string | null = null

  register(pack: DomainPack): void {
    if (!this.packs.has(pack.id) && this.firstId === null) this.firstId = pack.id
    this.packs.set(pack.id, pack)
  }

  get(id: string): DomainPack {
    const pack = this.packs.get(id) ?? (this.firstId ? this.packs.get(this.firstId) : undefined)
    if (!pack) throw new Error(`No domain pack registered for id "${id}" and no default available`)
    return pack
  }

  has(id: string): boolean {
    return this.packs.has(id)
  }

  list(): DomainPack[] {
    return Array.from(this.packs.values())
  }

  defaultId(): string {
    if (!this.firstId) throw new Error('No domain packs registered')
    return this.firstId
  }
}

/** The process-wide registry singleton. */
export const packRegistry: DomainPackRegistry = new Registry()

/** Convenience: resolve a campaign's pack, falling back to the default. */
export function resolvePack(packId: string | undefined): DomainPack {
  return packRegistry.get(packId ?? packRegistry.defaultId())
}
