import fs from 'fs'
import path from 'path'
import type webpack from 'webpack'
import WebExtension from 'webpack-target-webextension'
import {type PluginInterface} from '../../../reload-types'
import {type Manifest} from '../../../../webpack-types'
import {type DevOptions} from '../../../../../commands/commands-lib/config-types'
import * as messages from '../../../../lib/messages'
import * as utils from '../../../../lib/utils'

export class TargetWebExtensionPlugin {
  private readonly manifestPath: string
  private readonly browser: DevOptions['browser']

  constructor(options: PluginInterface) {
    this.manifestPath = options.manifestPath
    this.browser = options.browser || 'chrome'
  }

  private handleBackground(
    compiler: webpack.Compiler,
    browser: DevOptions['browser'],
    manifest: Manifest
  ) {
    const minimumBgScript = path.resolve(
      __dirname,
      browser === 'firefox' || browser === 'gecko-based'
        ? 'minimum-firefox-file.mjs'
        : 'minimum-chromium-file.mjs'
    )

    const dirname = path.dirname(this.manifestPath!)
    let manifestBg: Record<string, any> | undefined =
      utils.filterKeysForThisBrowser(manifest, browser)

    if (browser === 'firefox' || browser === 'gecko-based') {
      manifestBg = manifest.background

      const backgroundScripts = manifestBg?.scripts

      if (backgroundScripts && backgroundScripts.length > 0) {
        const backgroundScriptsPath = path.join(dirname, backgroundScripts[0])
        this.ensureFileExists(backgroundScriptsPath)
      } else {
        this.addDefaultEntry(compiler, 'background/script', minimumBgScript)
      }
    } else {
      manifestBg = manifest.background

      if (manifest.manifest_version === 3) {
        const serviceWorker = manifestBg?.service_worker

        if (serviceWorker) {
          const serviceWorkerPath = path.join(dirname, serviceWorker)

          this.ensureFileExists(serviceWorkerPath)
        } else {
          this.addDefaultEntry(
            compiler,
            'background/service_worker',
            minimumBgScript
          )
        }
      } else if (manifest.manifest_version === 2) {
        const backgroundScripts = manifestBg?.scripts

        if (backgroundScripts && backgroundScripts.length > 0) {
          const backgroundScriptPath = path.join(dirname, backgroundScripts[0])
          this.ensureFileExists(backgroundScriptPath)
        } else {
          this.addDefaultEntry(compiler, 'background/script', minimumBgScript)
        }
      }
    }
  }

  private ensureFileExists(filePath: string) {
    if (!fs.existsSync(filePath)) {
      if (this.manifestPath) {
        const manifest = require(this.manifestPath)
        const patchedManifest = utils.filterKeysForThisBrowser(
          manifest,
          'chrome'
        )

        const manifestName = patchedManifest.name || 'Extension.js'

        const fieldError = messages.backgroundIsRequired(manifestName, filePath)
        console.error(fieldError)
        throw new Error(fieldError)
      }
    }
  }

  private addDefaultEntry(
    compiler: webpack.Compiler,
    name: string,
    defaultScript: string
  ) {
    compiler.options.entry = {
      ...compiler.options.entry,
      [name]: {import: [defaultScript]}
    }
  }

  private getEntryName(manifest: Manifest) {
    if (manifest.background) {
      if (this.browser === 'firefox' || this.browser === 'gecko-based') {
        return {pageEntry: 'background/script'}
      }

      if (manifest.manifest_version === 3) {
        return {serviceWorkerEntry: 'background/service_worker'}
      }

      if (manifest.manifest_version === 2) {
        return {pageEntry: 'background/script'}
      }
    }

    return {pageEntry: 'background'}
  }

  public apply(compiler: webpack.Compiler) {
    if (!this.manifestPath || !fs.lstatSync(this.manifestPath).isFile()) {
      return
    }

    const manifest: Manifest = require(this.manifestPath)
    const patchedManifest = utils.filterKeysForThisBrowser(
      manifest,
      this.browser
    )

    this.handleBackground(compiler, this.browser, patchedManifest)

    new WebExtension({
      background: this.getEntryName(patchedManifest),
      weakRuntimeCheck: true
    }).apply(compiler)
  }
}
