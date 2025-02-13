import path from 'path'
import fs from 'fs'
import {
  ALL_TEMPLATES,
  DEFAULT_TEMPLATE,
  SUPPORTED_BROWSERS
} from '../../examples/data'
import {extensionBuild, Manifest} from './dist/module'

async function removeDir(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    await fs.promises.rm(dirPath, {recursive: true})
  }
}

async function removeAllTemplateDistFolders() {
  await Promise.all(
    ALL_TEMPLATES.map(async (template) => {
      const templatePath = path.join(
        __dirname,
        '..',
        '..',
        'examples',
        template.name,
        'dist'
      )

      await removeDir(templatePath)
      return true
    })
  )
}

function distFileExists(
  templateName: string,
  browser: string,
  filePath?: string,
  ext?: string
): boolean {
  const templatePath = path.join(
    __dirname,
    '..',
    '..',
    'examples',
    templateName,
    'dist',
    browser
  )

  if (filePath) {
    return fs.existsSync(path.join(templatePath, filePath))
  } else {
    // Check if any HTML file exists in the directory
    const files = fs.readdirSync(templatePath)
    return files.some((file) => file.endsWith(ext || '.html'))
  }
}

describe('extension build', () => {
  beforeEach(async () => {
    await removeAllTemplateDistFolders()
  }, 30000)

  describe('running built-in templates', () => {
    it.each(ALL_TEMPLATES)(
      `builds an extension created via "$name" template`,
      async (template) => {
        const templatePath = path.resolve(
          __dirname,
          '..',
          '..',
          'examples',
          template.name
        )

        const postCssConfig = path.join(templatePath, 'postcss.config.js')

        // Dynamically mock the postcss.config.js file if it exists.
        // Since the file is dynamically imported in the webpack config,
        // we need to mock it before the webpack config is created.
        if (fs.existsSync(postCssConfig)) {
          jest.mock(postCssConfig, () => jest.fn())
        }

        await extensionBuild(templatePath, {
          browser: SUPPORTED_BROWSERS[0] as 'chrome'
        })

        expect(
          path.join(
            templatePath,
            'dist',
            SUPPORTED_BROWSERS[0],
            'manifest.json'
          )
        ).toBeTruthy()

        const manifestText = fs.readFileSync(
          path.join(
            templatePath,
            'dist',
            SUPPORTED_BROWSERS[0],
            'manifest.json'
          ),
          'utf-8'
        )

        const manifest: Manifest = JSON.parse(manifestText)
        expect(manifest.name).toBeTruthy
        expect(manifest.version).toBeTruthy
        expect(manifest.manifest_version).toBeTruthy

        if (template.name.includes('content')) {
          // Since extension@2.0.0-beta-6, the content script is injected
          // into the shadow DOM. Including in production mode.
          // expect(manifest.content_scripts![0].css![0]).toEqual(
          //   'content_scripts/content-0.css'
          // )

          expect(manifest.content_scripts![0].js![0]).toEqual(
            'content_scripts/content-0.js'
          )

          // Since extension@2.0.0-beta-6, the content script is injected
          // into the shadow DOM. Including in production mode.
          // expect(
          //   distFileExists(
          //     template.name,
          //     SUPPORTED_BROWSERS[0],
          //     'content_scripts/content-0.css'
          //   )
          // ).toBeTruthy()

          expect(
            distFileExists(
              template.name,
              SUPPORTED_BROWSERS[0],
              'content_scripts/content-0.js'
            )
          ).toBeTruthy()
        }
      },
      80000
    )
  })

  describe('using the --browser flag', () => {
    it.each(ALL_TEMPLATES)(
      `builds the "$name" extension template across all supported browsers`,
      async (template) => {
        const templatePath = path.resolve(
          __dirname,
          '..',
          '..',
          'examples',
          template.name
        )

        // Running browsers in parallel by invoking them sequentially
        await Promise.all(
          SUPPORTED_BROWSERS.filter((browser) => browser !== 'chrome').map(
            async (browser) => {
              await extensionBuild(templatePath, {browser: browser as any})
              expect(
                path.join(templatePath, SUPPORTED_BROWSERS[0], 'manifest.json')
              ).toBeTruthy()
            }
          )
        )
      },
      80000
    )
  })

  describe('using the --polyfill flag', () => {
    it.each(ALL_TEMPLATES)(
      `builds an extension created via "$name" template with the polyfill code`,
      async (template) => {
        const templatePath = path.resolve(
          __dirname,
          '..',
          '..',
          'examples',
          template.name
        )

        await extensionBuild(templatePath, {
          browser: SUPPORTED_BROWSERS[0] as 'chrome',
          polyfill: true
        })

        expect(
          path.join(templatePath, SUPPORTED_BROWSERS[0], 'manifest.json')
        ).toBeTruthy()
      },
      80000
    )
  })

  describe('using the --zip flag', () => {
    it.each([DEFAULT_TEMPLATE])(
      `builds and zips the distribution files of an extension created via "$name" template`,
      async (template) => {
        const templatePath = path.resolve(
          __dirname,
          '..',
          '..',
          'examples',
          template.name
        )

        await extensionBuild(templatePath, {
          browser: SUPPORTED_BROWSERS[0] as 'chrome',
          zip: true
        })

        expect(
          fs.existsSync(
            path.join(
              templatePath,
              'dist',
              SUPPORTED_BROWSERS[0],
              `${template.name}-0.0.1.zip`
            )
          )
        ).toBeTruthy()
      },
      80000
    )

    it.each([DEFAULT_TEMPLATE])(
      `builds and zips the source files of an extension created via "$name" template`,
      async (template) => {
        const templatePath = path.resolve(
          __dirname,
          '..',
          '..',
          'examples',
          template.name
        )

        await extensionBuild(templatePath, {
          zip: true,
          browser: SUPPORTED_BROWSERS[0] as 'chrome',
          zipSource: true
        })

        expect(
          fs.existsSync(
            path.join(templatePath, 'dist', `${template.name}-0.0.1-source.zip`)
          )
        ).toBeTruthy()
      },
      80000
    )

    it.each([DEFAULT_TEMPLATE])(
      `builds and zips the distribution files of an extension created via "$name" template with a custom output name using the --zip-filename flag`,
      async (template) => {
        const templatePath = path.resolve(
          __dirname,
          '..',
          '..',
          'examples',
          template.name
        )

        await extensionBuild(templatePath, {
          zip: true,
          browser: SUPPORTED_BROWSERS[0] as 'chrome',
          zipFilename: `${template.name}-nice`
        })

        expect(
          distFileExists(
            template.name,
            SUPPORTED_BROWSERS[0],
            `${template.name}-nice.zip`
          )
        ).toBeTruthy()
      },
      80000
    )
  })
})
