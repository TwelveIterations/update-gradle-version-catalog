/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import * as catalog from '../__fixtures__/catalog.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/catalog.js', () => catalog)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        ref: 'kotlin',
        version: '1.9.20'
      }
      return inputs[name] || ''
    })

    // Mock the catalog function to return a successful update.
    catalog.updateCatalogVersion.mockResolvedValue({
      oldVersion: '1.9.10',
      version: '1.9.20'
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Sets the updated output to true when version changes', async () => {
    await run()

    // Verify the updated output was set to true.
    expect(core.setOutput).toHaveBeenNthCalledWith(1, 'updated', true)
    expect(core.setOutput).toHaveBeenNthCalledWith(2, 'version', '1.9.20')
  })

  it('Sets the updated output to false when version stays the same', async () => {
    catalog.updateCatalogVersion.mockResolvedValue({
      oldVersion: '1.9.10',
      version: '1.9.10'
    })

    await run()

    // When oldVersion === newVersion, updated should be false
    expect(core.setOutput).toHaveBeenNthCalledWith(1, 'updated', false)
    expect(core.setOutput).toHaveBeenNthCalledWith(2, 'version', '1.9.10')
  })

  it('Sets the updated output to false when version does not change (undefined)', async () => {
    catalog.updateCatalogVersion.mockResolvedValue({
      oldVersion: '1.9.10',
      version: undefined
    })

    await run()

    // When version is undefined, no update occurred
    expect(core.setOutput).toHaveBeenNthCalledWith(1, 'updated', false)
    expect(core.setOutput).toHaveBeenNthCalledWith(2, 'version', '1.9.10')
  })

  it('Sets a failed status when catalog update throws error', async () => {
    const errorMessage = 'target not found'
    catalog.updateCatalogVersion.mockRejectedValueOnce(new Error(errorMessage))

    await run()

    // Verify that the action was marked as failed.
    expect(core.setFailed).toHaveBeenNthCalledWith(1, errorMessage)
  })

  it('Calls updateCatalogVersion with correct parameters', async () => {
    await run()

    // Verify the catalog function was called with the correct parameters.
    expect(catalog.updateCatalogVersion).toHaveBeenCalledWith({
      ref: 'kotlin',
      library: undefined,
      plugin: undefined,
      version: '1.9.20'
    })
  })
})
