import type { updateCatalogVersion } from '../src/catalog.js'
import { jest } from '@jest/globals'

export const updateCatalogVersion = jest.fn<typeof updateCatalogVersion>()
