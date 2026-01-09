import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  replaceVersionRef,
  replaceInlineVersion,
  replaceShortNotation,
  parseShortNotation
} from '../src/catalog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, '..', '__fixtures__')

const { updateCatalogVersion } = await import('../src/catalog.js')

describe('catalog.ts', () => {
  let tempFile: string
  let originalContent: string

  beforeEach(async () => {
    originalContent = await fs.readFile(
      path.join(fixturesDir, 'libs.versions.toml'),
      'utf-8'
    )
    tempFile = path.join(fixturesDir, 'test-temp.versions.toml')
    await fs.writeFile(tempFile, originalContent)
  })

  afterEach(async () => {
    try {
      await fs.unlink(tempFile)
    } catch {
      // ignore if file doesn't exist
    }
  })

  describe('format preservation', () => {
    it('preserves inline table format when updating version ref', async () => {
      await updateCatalogVersion({
        ref: 'minecraft',
        version: '1.21.99',
        catalog: tempFile
      })

      const content = await fs.readFile(tempFile, 'utf-8')

      // Should preserve inline table format
      expect(content).toContain(
        'minecraft = { module = "com.mojang:minecraft", version.ref = "minecraft" }'
      )
      // Should update the version in [versions] section
      expect(content).toContain('minecraft = "1.21.99"')
      // Should NOT have expanded table format
      expect(content).not.toContain('[libraries.minecraft]')
      expect(content).not.toContain('[libraries.minecraft.version]')
    })

    it('preserves inline table format when updating library with inline version', async () => {
      await updateCatalogVersion({
        library: 'parchment',
        version: '2025.12.01',
        catalog: tempFile
      })

      const content = await fs.readFile(tempFile, 'utf-8')

      // Should preserve inline table format with updated version
      expect(content).toContain(
        'parchment = { module = "org.parchmentmc.data:parchment-1.21.10", version = "2025.12.01" }'
      )
      // Should NOT have expanded table format
      expect(content).not.toContain('[libraries.parchment]')
    })

    it('preserves inline table format when updating plugin with inline version', async () => {
      await updateCatalogVersion({
        plugin: 'modDevGradle',
        version: '3.0.0',
        catalog: tempFile
      })

      const content = await fs.readFile(tempFile, 'utf-8')

      // Should preserve inline table format with updated version
      expect(content).toContain(
        'modDevGradle = { id = "net.neoforged.moddev", version = "3.0.0" }'
      )
      // Should NOT have expanded table format
      expect(content).not.toContain('[plugins.modDevGradle]')
    })

    it('preserves all other entries when updating one entry', async () => {
      await updateCatalogVersion({
        ref: 'balm',
        version: '22.0.0',
        catalog: tempFile
      })

      const content = await fs.readFile(tempFile, 'utf-8')

      // Other inline tables should be preserved
      expect(content).toContain(
        'balmCommon = { module = "net.blay09.mods:balm-common", version.ref = "balm" }'
      )
      expect(content).toContain(
        'fabricLoom = { id = "fabric-loom", version = "1.13-SNAPSHOT" }'
      )
    })
  })

  describe('version updates', () => {
    it('updates version ref correctly', async () => {
      const result = await updateCatalogVersion({
        ref: 'minecraft',
        version: '1.21.99',
        catalog: tempFile
      })

      expect(result.oldVersion).toBe('1.21.11')
      expect(result.version).toBe('1.21.99')

      const content = await fs.readFile(tempFile, 'utf-8')
      expect(content).toContain('minecraft = "1.21.99"')
    })

    it('updates library with version ref correctly', async () => {
      const result = await updateCatalogVersion({
        library: 'minecraft',
        version: '1.21.99',
        catalog: tempFile
      })

      expect(result.oldVersion).toBe('1.21.11')
      expect(result.version).toBe('1.21.99')

      const content = await fs.readFile(tempFile, 'utf-8')
      // Version ref should be updated in [versions] section
      expect(content).toMatch(/^minecraft = "1\.21\.99"$/m)
    })

    it('updates library with inline version correctly', async () => {
      const result = await updateCatalogVersion({
        library: 'parchment',
        version: '2025.12.01',
        catalog: tempFile
      })

      expect(result.oldVersion).toBe('2025.10.12')
      expect(result.version).toBe('2025.12.01')
    })

    it('updates plugin with inline version correctly', async () => {
      const result = await updateCatalogVersion({
        plugin: 'modDevGradle',
        version: '3.0.0',
        catalog: tempFile
      })

      expect(result.oldVersion).toBe('2.0.107')
      expect(result.version).toBe('3.0.0')
    })

    it('returns old version without modifying file when version is not provided', async () => {
      const result = await updateCatalogVersion({
        ref: 'minecraft',
        catalog: tempFile
      })

      expect(result.oldVersion).toBe('1.21.11')
      expect(result.version).toBeUndefined()

      const content = await fs.readFile(tempFile, 'utf-8')
      expect(content).toBe(originalContent)
    })
  })

  describe('error handling', () => {
    it('throws error for non-existent ref', async () => {
      await expect(
        updateCatalogVersion({
          ref: 'nonexistent',
          version: '1.0.0',
          catalog: tempFile
        })
      ).rejects.toThrow("ref 'nonexistent' not found in [versions] section")
    })

    it('throws error for non-existent library', async () => {
      await expect(
        updateCatalogVersion({
          library: 'nonexistent',
          version: '1.0.0',
          catalog: tempFile
        })
      ).rejects.toThrow(
        "library 'nonexistent' not found in [libraries] section"
      )
    })

    it('throws error for non-existent plugin', async () => {
      await expect(
        updateCatalogVersion({
          plugin: 'nonexistent',
          version: '1.0.0',
          catalog: tempFile
        })
      ).rejects.toThrow("plugin 'nonexistent' not found in [plugins] section")
    })

    it('throws error when no target is provided', async () => {
      await expect(
        updateCatalogVersion({
          version: '1.0.0',
          catalog: tempFile
        })
      ).rejects.toThrow('One of ref, library, or plugin must be provided')
    })
  })

  describe('library lookup by module', () => {
    it('finds library by module name', async () => {
      const result = await updateCatalogVersion({
        library: 'com.mojang:minecraft',
        version: '1.21.99',
        catalog: tempFile
      })

      expect(result.oldVersion).toBe('1.21.11')
    })

    it('finds library by group id prefix', async () => {
      const result = await updateCatalogVersion({
        library: 'com.mojang',
        version: '1.21.99',
        catalog: tempFile
      })

      expect(result.oldVersion).toBe('1.21.11')
    })
  })

  describe('plugin lookup by id', () => {
    it('finds plugin by id', async () => {
      const result = await updateCatalogVersion({
        plugin: 'net.neoforged.moddev',
        version: '3.0.0',
        catalog: tempFile
      })

      expect(result.oldVersion).toBe('2.0.107')
    })
  })

  describe('short notation support', () => {
    let shortNotationFile: string

    beforeEach(async () => {
      shortNotationFile = path.join(fixturesDir, 'test-short-notation.toml')
      await fs.writeFile(
        shortNotationFile,
        `[versions]
kotlin = "1.9.20"

[libraries]
shortLib = "com.example:library:1.0.0"
inlineLib = { module = "com.example:other", version = "2.0.0" }
refLib = { module = "com.example:ref", version.ref = "kotlin" }
`
      )
    })

    afterEach(async () => {
      try {
        await fs.unlink(shortNotationFile)
      } catch {
        // ignore
      }
    })

    it('updates library with short notation format', async () => {
      const result = await updateCatalogVersion({
        library: 'shortLib',
        version: '1.5.0',
        catalog: shortNotationFile
      })

      expect(result.oldVersion).toBe('1.0.0')
      expect(result.version).toBe('1.5.0')

      const content = await fs.readFile(shortNotationFile, 'utf-8')
      expect(content).toContain('shortLib = "com.example:library:1.5.0"')
    })

    it('finds short notation library by module name', async () => {
      const result = await updateCatalogVersion({
        library: 'com.example:library',
        version: '1.5.0',
        catalog: shortNotationFile
      })

      expect(result.oldVersion).toBe('1.0.0')
    })

    it('preserves short notation format after update', async () => {
      await updateCatalogVersion({
        library: 'shortLib',
        version: '1.5.0',
        catalog: shortNotationFile
      })

      const content = await fs.readFile(shortNotationFile, 'utf-8')
      // Should NOT expand to inline table format
      expect(content).not.toContain('[libraries.shortLib]')
      expect(content).toContain('shortLib = "com.example:library:1.5.0"')
    })
  })

  describe('inline replacement utilities', () => {
    const sharedTestInput: string = `[versions]
kotlin = "1.9.20"

[libraries]
kotlinShort = "org.jetbrains.kotlin:kotlin-bom:1.9.20"
kotlinInline = { module = "org.jetbrains.kotlin:kotlin-bom", version = "1.9.20" }
kotlinRef = { module = "org.jetbrains.kotlin:kotlin-bom", version.ref = "kotlin" }
    `

    it('replaces version ref versions', () => {
      const result = replaceVersionRef(sharedTestInput, 'kotlin', '1.10.0')
      expect(result).toContain('kotlin = "1.10.0"')
    })

    it('replaces inline version versions', () => {
      const result = replaceInlineVersion(
        sharedTestInput,
        'kotlinInline',
        '1.10.0'
      )
      expect(result).toContain(
        'kotlinInline = { module = "org.jetbrains.kotlin:kotlin-bom", version = "1.10.0" }'
      )
    })

    it('replaces short notation versions', () => {
      const result = replaceShortNotation(
        sharedTestInput,
        'kotlinShort',
        '1.10.0'
      )
      expect(result).toContain(
        'kotlinShort = "org.jetbrains.kotlin:kotlin-bom:1.10.0"'
      )
    })

    it('parses short notation', () => {
      const result = parseShortNotation(
        'org.jetbrains.kotlin:kotlin-bom:1.9.20'
      )
      expect(result).toEqual({
        module: 'org.jetbrains.kotlin:kotlin-bom',
        version: '1.9.20'
      })
    })
  })
})
