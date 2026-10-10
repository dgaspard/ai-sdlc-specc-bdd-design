// Template tier: runs infra/synth once per test run (DC-002) with every AWS credential
// removed, proving synthesis is offline, then loads infra/out/<env>/*.template.json.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as repo from "./repo.js";

let synthesized;

function synthOnce() {
  if (synthesized) return synthesized;
  if (!repo.exists("infra/synth")) {
    synthesized = { error: "DC-002: infra/synth is missing" };
    return synthesized;
  }
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("AWS_")));
  env.AWS_EC2_METADATA_DISABLED = "true";
  const result = spawnSync(repo.abs("infra/synth"), [], { cwd: repo.ROOT, env, encoding: "utf8" });
  synthesized = result.status === 0 ? {} : { error: `DC-002: infra/synth failed without AWS credentials\n${result.stderr}` };
  return synthesized;
}

export function load(env) {
  const { error } = synthOnce();
  if (error) throw new Error(error);
  const dir = repo.abs(`infra/out/${env}`);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".template.json")).sort() : [];
  if (files.length === 0) throw new Error(`DC-002: no templates in infra/out/${env}/*.template.json`);
  return files.map((f) => ({ env, file: path.join(dir, f), json: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) }));
}

export const resources = (templates, type) =>
  templates.flatMap((t) =>
    Object.entries(t.json.Resources ?? {})
      .filter(([, r]) => !type || r.Type === type)
      .map(([id, r]) => ({ template: t, id, ...r })),
  );

export const containers = (templates) =>
  resources(templates, "AWS::ECS::TaskDefinition").flatMap((td) =>
    (td.Properties?.ContainerDefinitions ?? []).map((c) => ({ template: td.template, task: td.id, ...c })),
  );

export function cfnGuard(rulesFile, dataFiles) {
  try {
    execFileSync("cfn-guard", ["--version"], { stdio: "ignore" });
  } catch {
    throw new Error("tooling: cfn-guard is not installed (see README: Prerequisites)");
  }
  const args = ["validate", "--rules", rulesFile, "--show-summary", "fail"];
  for (const f of dataFiles) args.push("--data", f);
  const result = spawnSync("cfn-guard", args, { encoding: "utf8" });
  return { ok: result.status === 0, output: `${result.stdout}\n${result.stderr}` };
}
