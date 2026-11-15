import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { FONT_STACKS, TYPOGRAPHY } from "../src/styles/typography";

test("Typography system provides standardized English (Inter) and Arabic (IBM Plex Sans Arabic) font stacks", () => {
  assert.ok(FONT_STACKS.en.includes("Inter"));
  assert.ok(FONT_STACKS.ar.includes("IBM Plex Sans Arabic"));
  assert.ok(FONT_STACKS.mono.includes("JetBrains Mono"));
});

test("Typography scale tokens cover complete hierarchy from display to tabular nums", () => {
  assert.ok(TYPOGRAPHY.display);
  assert.ok(TYPOGRAPHY.h1);
  assert.ok(TYPOGRAPHY.h2);
  assert.ok(TYPOGRAPHY.h3);
  assert.ok(TYPOGRAPHY.body);
  assert.ok(TYPOGRAPHY.small);
  assert.ok(TYPOGRAPHY.caption);
  assert.ok(TYPOGRAPHY.tabular.includes("tabular-nums"));
});

test("/public/icon.svg is a valid dark-theme vector representing the ReFocus aperture of clarity", () => {
  const iconPath = path.resolve(process.cwd(), "public/icon.svg");
  assert.ok(fs.existsSync(iconPath), "public/icon.svg must exist");
  const svgContent = fs.readFileSync(iconPath, "utf-8");
  assert.ok(svgContent.includes("<svg"), "Must contain opening <svg tag");
  assert.ok(svgContent.includes("viewBox=\"0 0 512 512\""), "Must have standard 512x512 viewBox");
  assert.ok(svgContent.includes("#151820"), "Must use the charcoal app background");
  assert.ok(svgContent.includes("#F4CE25"), "Must use the yellow brand accent");
});

test("index.html preloads Inter and IBM Plex Sans Arabic fonts with display=swap", () => {
  const htmlPath = path.resolve(process.cwd(), "index.html");
  const htmlContent = fs.readFileSync(htmlPath, "utf-8");
  assert.ok(htmlContent.includes("IBM+Plex+Sans+Arabic"), "index.html must load IBM Plex Sans Arabic");
  assert.ok(htmlContent.includes("Inter"), "index.html must load Inter");
  assert.ok(htmlContent.includes("display=swap"), "Must use font-display swap for zero layout shifts");
});
