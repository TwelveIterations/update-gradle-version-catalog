import { parse, stringify } from 'smol-toml'
import fs from 'fs/promises'

type VersionCatalog = {
  versions: Record<string, string>
  libraries: Record<
    string,
    { module: string; version: string | { ref: string } }
  >
  plugins: Record<string, { id: string; version: string | { ref: string } }>
}

function updateModuleVersion(
  catalog: VersionCatalog,
  entry: { version: string | { ref: string } },
  version: string | undefined
): string {
  if (typeof entry.version === 'string') {
    const oldVersion = entry.version
    if (version) {
      entry.version = version
    }
    return oldVersion
  } else if (typeof entry.version === 'object') {
    const ref = entry.version.ref
    const oldVersion = catalog['versions'][ref]
    if (version) {
      catalog['versions'][ref] = version
    }
    return oldVersion
  }
  throw new Error('Invalid version structure')
}

export async function updateCatalogVersion(options: {
  ref?: string
  library?: string
  plugin?: string
  version?: string
  catalog?: string
}): Promise<{ oldVersion: string; version?: string }> {
  const {
    ref,
    library,
    plugin,
    version,
    catalog: catalogPath = 'gradle/libs.versions.toml'
  } = options

  if (version && typeof version !== 'string') {
    throw new Error('version is not a string')
  }

  const catalogContent = await fs.readFile(catalogPath, {
    encoding: 'utf-8'
  })
  const catalog = parse(catalogContent) as VersionCatalog

  let oldVersion: string | undefined

  if (ref) {
    if (!catalog.versions?.[ref]) {
      throw new Error(`ref '${ref}' not found in [versions] section`)
    }
    oldVersion = catalog.versions[ref]
    if (version) {
      catalog.versions[ref] = version
    }
  } else if (library) {
    let entry = catalog.libraries?.[library]
    if (!entry) {
      const key = Object.keys(catalog.libraries ?? {}).find((k) => {
        const module = catalog.libraries[k].module
        return module === library || module.startsWith(library + ':')
      })
      if (key) entry = catalog.libraries[key]
    }
    if (!entry) {
      throw new Error(`library '${library}' not found in [libraries] section`)
    }
    oldVersion = updateModuleVersion(catalog, entry, version)
  } else if (plugin) {
    let entry = catalog.plugins?.[plugin]
    if (!entry) {
      const key = Object.keys(catalog.plugins ?? {}).find(
        (k) => catalog.plugins[k].id === plugin
      )
      if (key) entry = catalog.plugins[key]
    }
    if (!entry) {
      throw new Error(`plugin '${plugin}' not found in [plugins] section`)
    }
    oldVersion = updateModuleVersion(catalog, entry, version)
  } else {
    throw new Error('One of ref, library, or plugin must be provided')
  }

  await fs.writeFile(catalogPath, stringify(catalog))
  return { oldVersion, version }
}
