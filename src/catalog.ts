import { parse, stringify } from 'smol-toml'
import fs from 'fs/promises'

type VersionCatalog = {
  versions: Record<string, string>
  libraries: Record<
    string,
    { module: string; version: string | { ref: string } }
  >
  plugins: Record<string, { module: string; version: string | { ref: string } }>
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
  target?: string
  targetType?: string
  version?: string
  section?: string
}): Promise<{ oldVersion: string; version?: string }> {
  const { version, target, targetType, section } = options
  if (!target || typeof target !== 'string') {
    throw new Error('target is not a string')
  }
  if (targetType && typeof targetType !== 'string') {
    throw new Error('target_type is not a string')
  }
  if (targetType && targetType !== 'ref' && targetType !== 'module') {
    throw new Error('target_type is not a valid target type')
  }
  if (version && typeof version !== 'string') {
    throw new Error('version is not a string')
  }
  if (!section || typeof section !== 'string') {
    throw new Error('section is not a string')
  }
  if (
    section !== 'versions' &&
    section !== 'libraries' &&
    section !== 'plugins'
  ) {
    throw new Error('section is not a valid section')
  }

  const catalogContent = await fs.readFile('gradle/libs.versions.toml', {
    encoding: 'utf-8'
  })
  const catalog = parse(catalogContent) as VersionCatalog

  const defaultSections = ['versions', 'libraries', 'plugins'] as const
  const searchSections = (
    section ? [section, ...defaultSections] : defaultSections
  ) as (typeof defaultSections)[number][]
  let oldVersion: string | undefined
  outer: for (const searchSection of searchSections) {
    if (!catalog[searchSection]) {
      continue
    }

    if (
      (!targetType || targetType === 'ref') &&
      catalog[searchSection][target]
    ) {
      if (searchSection === 'versions') {
        oldVersion = catalog[searchSection][target]
        if (version) {
          catalog[searchSection][target] = version
        }
        break outer
      } else {
        oldVersion = updateModuleVersion(
          catalog,
          catalog[searchSection][target],
          version
        )
        break outer
      }
    } else if (targetType === 'module' && searchSection !== 'versions') {
      for (const key of Object.keys(catalog[searchSection])) {
        if (catalog[searchSection][key].module === target) {
          oldVersion = updateModuleVersion(
            catalog,
            catalog[searchSection][key],
            version
          )
          break outer
        }
      }
    }
  }

  if (!oldVersion) {
    throw new Error('target not found')
  }

  await fs.writeFile('gradle/libs.versions.toml', stringify(catalog))
  return { oldVersion, version }
}
