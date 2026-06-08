import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {pack} from 'tar-stream'
import {ContainerService} from '../src/container-service'

describe('ContainerService.extractJobSummary', () => {
  let stepSummaryPath: string
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dependabot-action-test-'))
    stepSummaryPath = path.join(tmpDir, 'step-summary.md')
    fs.writeFileSync(stepSummaryPath, '')
    process.env.GITHUB_STEP_SUMMARY = stepSummaryPath
  })

  afterEach(() => {
    delete process.env.GITHUB_STEP_SUMMARY
    fs.rmSync(tmpDir, {recursive: true, force: true})
  })

  test('extracts summary.md from container and appends to GITHUB_STEP_SUMMARY', async () => {
    const markdownContent =
      '## Dependency Graph Snapshot\n\n| Directory | Status |\n'

    // Create a tar archive containing the summary file
    const tarStream = pack()
    tarStream.entry({name: 'summary.md'}, markdownContent)
    tarStream.finalize()

    const mockContainer = {
      getArchive: jest.fn().mockResolvedValue(tarStream)
    } as any

    await ContainerService.extractJobSummary(mockContainer)

    const written = fs.readFileSync(stepSummaryPath, 'utf-8')
    expect(written).toEqual(markdownContent)
    expect(mockContainer.getArchive).toHaveBeenCalledWith({
      path: '/home/dependabot/dependabot-updater/output/summary.md'
    })
  })

  test('gracefully skips when file does not exist in container', async () => {
    const mockContainer = {
      getArchive: jest.fn().mockRejectedValue(new Error('file not found: 404'))
    } as any

    await ContainerService.extractJobSummary(mockContainer)

    const written = fs.readFileSync(stepSummaryPath, 'utf-8')
    expect(written).toEqual('')
  })

  test('does not write to GITHUB_STEP_SUMMARY when summary.md is empty', async () => {
    const tarStream = pack()
    tarStream.entry({name: 'summary.md'}, '')
    tarStream.finalize()

    const mockContainer = {
      getArchive: jest.fn().mockResolvedValue(tarStream)
    } as any

    await ContainerService.extractJobSummary(mockContainer)

    const written = fs.readFileSync(stepSummaryPath, 'utf-8')
    expect(written).toEqual('')
  })

  test('does nothing when GITHUB_STEP_SUMMARY is not set', async () => {
    delete process.env.GITHUB_STEP_SUMMARY

    const mockContainer = {
      getArchive: jest.fn()
    } as any

    await ContainerService.extractJobSummary(mockContainer)

    expect(mockContainer.getArchive).not.toHaveBeenCalled()
  })
})
