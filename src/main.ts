import * as core from '@actions/core'
import { updateCatalogVersion } from './catalog.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const target: string = core.getInput('target')
    const targetType: string = core.getInput('target_type')
    const version: string = core.getInput('version')
    const section: string = core.getInput('section')
    const { oldVersion, version: newVersion } = await updateCatalogVersion({
      target,
      targetType,
      version,
      section
    })
    const wasUpdated = newVersion !== undefined && newVersion !== oldVersion
    core.setOutput('updated', wasUpdated)
    core.setOutput('version', newVersion ?? oldVersion)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
