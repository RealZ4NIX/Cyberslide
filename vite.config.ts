import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/* the build id two players must share to link up: package version + commit, so every deploy is its own version */
function buildId(): string {
  const sha = process.env.GITHUB_SHA?.slice(0, 7);
  if (sha) return `${pkg.version}+${sha}`;
  try {
    return `${pkg.version}+${execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()}`;
  } catch {
    return `${pkg.version}+dev`;
  }
}

export default defineConfig({
  // relative asset paths so the build works under GitHub Pages' /Cyberslide/ sub-path
  base: './',
  define: { __APP_VERSION__: JSON.stringify(buildId()) },
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', 'dist/**'],
  },
});
