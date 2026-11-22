import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { CHANNEL_LIMITS } from "@/lib/ai/types";
import {
  PEERLIST_DRAFT_STORAGE_KEY,
  PEERLIST_MESSAGE,
} from "@/lib/extension/peerlist-bridge";

const ROOT = path.resolve(__dirname, "..");
const EXT = path.join(ROOT, "extension");

function read(relative: string) {
  return readFileSync(path.join(EXT, relative), "utf8");
}

const manifest = JSON.parse(read("manifest.json")) as {
  manifest_version: number;
  permissions: string[];
  host_permissions: string[];
  background: { service_worker: string };
  action: { default_popup: string };
  content_scripts: { matches: string[]; js: string[]; run_at?: string }[];
};

const JS_FILES = [
  "background.js",
  "content-postone.js",
  "content-peerlist.js",
  "popup.js",
];

describe("extension/manifest.json", () => {
  it("is Manifest V3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("declares the storage, activeTab and tabs permissions", () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["storage", "activeTab", "tabs"])
    );
  });

  it("has host permissions for Peerlist, prod PostOne and local PostOne", () => {
    expect(new Set(manifest.host_permissions)).toEqual(
      new Set([
        "https://peerlist.io/*",
        "https://postone-sigma.vercel.app/*",
        "http://localhost:3000/*",
      ])
    );
  });

  it("points at files that exist", () => {
    expect(existsSync(path.join(EXT, manifest.background.service_worker))).toBe(true);
    expect(existsSync(path.join(EXT, manifest.action.default_popup))).toBe(true);
    for (const script of manifest.content_scripts) {
      for (const file of script.js) {
        expect(existsSync(path.join(EXT, file)), file).toBe(true);
      }
    }
    expect(existsSync(path.join(EXT, "popup.js"))).toBe(true);
    expect(existsSync(path.join(EXT, "popup.css"))).toBe(true);
  });

  it("injects content-postone on PostOne and content-peerlist on Peerlist", () => {
    const postone = manifest.content_scripts.find((script) =>
      script.js.includes("content-postone.js")
    );
    expect(postone?.matches).toEqual(
      expect.arrayContaining([
        "https://postone-sigma.vercel.app/*",
        "http://localhost:3000/*",
      ])
    );

    const peerlist = manifest.content_scripts.find((script) =>
      script.js.includes("content-peerlist.js")
    );
    expect(peerlist?.matches).toEqual(["https://peerlist.io/*"]);
  });

  it("loads scripts after the document is ready", () => {
    for (const script of manifest.content_scripts) {
      expect(script.run_at).toBe("document_idle");
    }
  });
});

describe("extension scripts", () => {
  it("are valid classic JavaScript (node --check equivalent)", () => {
    for (const file of JS_FILES) {
      const source = read(file);
      expect(() => new vm.Script(source, { filename: file }), file).not.toThrow();
    }
  });

  it("share the message names of lib/extension/peerlist-bridge", () => {
    const postone = read("content-postone.js");
    for (const type of Object.values(PEERLIST_MESSAGE)) {
      expect(postone, type).toContain(type);
    }
    expect(postone).toContain(PEERLIST_DRAFT_STORAGE_KEY);

    const background = read("background.js");
    expect(background).toContain(PEERLIST_DRAFT_STORAGE_KEY);
    expect(background).toContain("POSTONE_PEERLIST_FILL");

    const peerlist = read("content-peerlist.js");
    expect(peerlist).toContain("POSTONE_PEERLIST_FILL");
    expect(peerlist).toContain("POSTONE_PEERLIST_STATUS");
  });

  it("keep the popup character guard at CHANNEL_LIMITS.peerlist.content", () => {
    const popup = read("popup.js");
    const match = popup.match(/const DRAFT_MAX = (\d+);/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(CHANNEL_LIMITS.peerlist.content);
  });

  it("never click a submit/post button (fill only, user posts)", () => {
    for (const file of JS_FILES) {
      const source = read(file);
      expect(source, file).not.toMatch(/\.click\s*\(/);
      expect(source, file).not.toMatch(/requestSubmit/);
      expect(source, file).not.toMatch(/form\.submit/);
      expect(source, file).not.toMatch(/dispatchEvent\(new MouseEvent/);
    }
  });

  it("do not call network endpoints outside the declared hosts", () => {
    for (const file of JS_FILES) {
      const source = read(file);
      expect(source, file).not.toMatch(/fetch\s*\(/);
      expect(source, file).not.toMatch(/XMLHttpRequest/);
    }
  });
});
