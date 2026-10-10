#!/usr/bin/env node
// Writes the human guide (catalog.rendered_doc, relative to the repository root).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PKG, loadCatalog, render } from "./catalog.mjs";

const root = process.env.DELIVERY_REPO_ROOT ?? execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: PKG, encoding: "utf8" }).trim();
const catalog = loadCatalog();
const target = path.join(root, catalog.rendered_doc);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, render(catalog));
console.log(`wrote ${catalog.rendered_doc}`);
