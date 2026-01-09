import * as core from '@actions/core'
import { updateCatalogVersion } from './catalog.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const ref: string = core.getInput('ref')
    const library: string = core.getInput('library')
    const plugin: string = core.getInput('plugin')
    const version: string = core.getInput('version')

    const providedInputs = [ref, library, plugin].filter(Boolean)
    if (providedInputs.length === 0) {
      throw new Error('One of ref, library, or plugin must be provided')
    }
    if (providedInputs.length > 1) {
      throw new Error('Only one of ref, library, or plugin can be provided')
    }

    const { oldVersion, version: newVersion } = await updateCatalogVersion({
      ref: ref || undefined,
      library: library || undefined,
      plugin: plugin || undefined,
      version: version || undefined
    })
    const wasUpdated = newVersion !== undefined && newVersion !== oldVersion
    core.setOutput('updated', wasUpdated)
    core.setOutput('version', newVersion ?? oldVersion)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
