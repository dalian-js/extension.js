import * as fs from 'fs'
import rspack, {sources, type Compiler, Compilation} from '@rspack/core'
import {type FilepathList, type PluginInterface} from '../../../webpack-types'
import * as messages from '../../../lib/messages'
import * as utils from '../../../lib/utils'
import {getFilePath} from '../html-lib/utils'

export class EmitHtmlFile {
  public readonly manifestPath: string
  public readonly includeList?: FilepathList
  public readonly excludeList?: FilepathList

  constructor(options: PluginInterface) {
    this.manifestPath = options.manifestPath
    this.includeList = options.includeList
    this.excludeList = options.excludeList
  }

  public apply(compiler: Compiler): void {
    const manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'))
    const patchedManifest = utils.filterKeysForThisBrowser(manifest, 'chrome')

    const manifestName = patchedManifest.name || 'Extension.js'

    compiler.hooks.thisCompilation.tap('html:emit-html-file', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'AddAssetsToCompilationPlugin',
          // Derive new assets from the existing assets.
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
        },
        () => {
          const htmlFields = Object.entries(this.includeList || {})

          for (const field of htmlFields) {
            const [featureName, resource] = field

            if (resource) {
              if (typeof resource !== 'string') continue
              if (!fs.existsSync(resource)) {
                const errorMessage = messages.manifestFieldError(
                  manifestName,
                  featureName,
                  resource
                )
                compilation.warnings.push(new rspack.WebpackError(errorMessage))
                continue
              }
              const rawHtml = fs.readFileSync(resource, 'utf8')

              if (!utils.shouldExclude(resource, this.excludeList)) {
                const rawSource = new sources.RawSource(rawHtml)
                const filepath = getFilePath(featureName, '.html', false)
                compilation.emitAsset(filepath, rawSource)
              }
            }
          }
        }
      )
    })
  }
}
