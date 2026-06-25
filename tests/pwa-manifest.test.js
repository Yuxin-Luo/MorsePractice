import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';

const root = resolve(__dirname, '..');

describe('PWA manifest.json', () => {
  let manifest;
  beforeAll(() => {
    manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  });

  it('has required fields', () => {
    for (const k of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color', 'icons']) {
      expect(manifest, `manifest.${k}`).toHaveProperty(k);
    }
  });

  it('display is standalone', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('has at least 2 icons including maskable', () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    const maskable = manifest.icons.find((i) => i.purpose === 'maskable');
    expect(maskable, 'no maskable icon').toBeTruthy();
  });

  it('every icon src exists on disk', () => {
    for (const icon of manifest.icons) {
      const path = join(root, icon.src.replace(/^\//, ''));
      expect(existsSync(path), `icon missing: ${icon.src}`).toBe(true);
    }
  });
});

describe('Service Worker PRECACHE', () => {
  let urls;
  beforeAll(() => {
    const sw = readFileSync(join(root, 'sw.js'), 'utf8');
    const match = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
    expect(match, 'PRECACHE array not found in sw.js').toBeTruthy();
    urls = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  });

  it('has at least 10 precached urls', () => {
    expect(urls.length).toBeGreaterThanOrEqual(10);
  });

  it('every precached url exists on disk', () => {
    for (const url of urls) {
      // '/' 映射到 index.html
      const rel = url === '/' ? 'index.html' : url.replace(/^\//, '');
      const path = join(root, rel);
      expect(existsSync(path), `PRECACHE url missing: ${url}`).toBe(true);
    }
  });

  it('has cache version constant', () => {
    const sw = readFileSync(join(root, 'sw.js'), 'utf8');
    expect(sw).toMatch(/CACHE_VERSION\s*=\s*['"]morse-cache-v\d+['"]/);
  });
});

describe('assetlinks.json', () => {
  it('is valid JSON array', () => {
    const data = JSON.parse(readFileSync(join(root, '.well-known/assetlinks.json'), 'utf8'));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it('targets the expected Android package', () => {
    const data = JSON.parse(readFileSync(join(root, '.well-known/assetlinks.json'), 'utf8'));
    const target = data[0].target;
    expect(target.namespace).toBe('android_app');
    expect(target.package_name).toBe('com.github.yuxinluo.morsepractice');
    expect(Array.isArray(target.sha256_cert_fingerprints)).toBe(true);
  });
});