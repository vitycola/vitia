/**
 * Jest transform for .sql files imported with Vite's ?raw suffix.
 * In the browser/Vite build, "import sql from './file.sql?raw'" returns the
 * file's raw string content. This transform replicates that behavior for Jest
 * so src/db/migrate.web.ts can be tested in Node without Vite.
 *
 * Registered in package.json jest.transform as "^.+\\.sql$".
 * The moduleNameMapper strips "?raw" before it reaches the transform.
 */
const fs = require("fs");

module.exports = {
  process(sourceText, sourcePath) {
    // Return a CommonJS module whose default export is the raw SQL string.
    // ts-jest (isolatedModules CJS interop) resolves `import x from '...'` to
    // `module.exports` when __esModule is NOT set, or to `module.exports.default`
    // when __esModule IS set. We set __esModule so the default import gets the
    // string, not the wrapper object.
    const content = JSON.stringify(fs.readFileSync(sourcePath, "utf-8"));
    return { code: `Object.defineProperty(exports, '__esModule', { value: true }); exports.default = ${content};` };
  },
};
