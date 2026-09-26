import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import vi from "../../messages/vi.json";
import { POLICY_SLUGS } from "../lib/policies";

const LEGAL_NOTICE = "Không bán rượu, bia cho người chưa đủ 18 tuổi";

function keys(messages: object, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [prefix + key] : keys(value, `${prefix}${key}.`),
  );
}

describe("messages", () => {
  it("gives en every key vi has", () => {
    expect(keys(vi).filter((key) => !keys(en).includes(key))).toEqual([]);
  });

  it("carries the exact L19 notice in both locales, with an English translation on en", () => {
    expect(vi.Notice.legal).toBe(LEGAL_NOTICE);
    expect(en.Notice.legal).toBe(LEGAL_NOTICE);
    expect(en.Notice.translation).toBeTruthy();
  });

  it("has translated links and page copy for every required policy slug", () => {
    for (const slug of POLICY_SLUGS) {
      expect(vi.Policy.links[slug], slug).toBeTruthy();
      expect(en.Policy.links[slug], slug).toBeTruthy();
      expect(vi.Policy.pages[slug].title, slug).toBeTruthy();
      expect(en.Policy.pages[slug].title, slug).toBeTruthy();
    }
  });
});

describe("storefront components", () => {
  const dir = path.resolve(__dirname, "../app/[locale]");
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".tsx"));

  // Visible copy: JSX text and the attributes a reader or screen reader sees.
  const COPY_ATTRIBUTES = new Set(["aria-label", "alt", "title", "placeholder"]);

  function hardcodedCopy(file: string): string[] {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node) && /\p{L}/u.test(node.text)) found.push(node.text.trim());
      if (
        ts.isJsxAttribute(node) &&
        COPY_ATTRIBUTES.has(node.name.getText()) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      ) {
        found.push(node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  }

  it.each(files)("%s has no hardcoded copy", (file) => {
    expect(hardcodedCopy(path.join(dir, file))).toEqual([]);
  });
});
