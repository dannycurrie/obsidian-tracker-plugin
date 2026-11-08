/**
 * Copies the built plugin (main.js, manifest.json, styles.css) into a vault's
 * .obsidian/plugins/weekly-scoreboard/. Run through `npm run install:dev-vault`,
 * which builds first. Default vault: .scratch/2027-scoreboard/dev-vault; pass
 * another vault folder as the first argument to install there instead.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const vault = resolve(process.argv[2] ?? join(root, ".scratch/2027-scoreboard/dev-vault"));
if (!existsSync(join(vault, ".obsidian"))) {
  console.error(`No .obsidian folder in ${vault}: is it an Obsidian vault?`);
  process.exit(1);
}
const { id } = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const dest = join(vault, ".obsidian", "plugins", id);
mkdirSync(dest, { recursive: true });
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  copyFileSync(join(root, file), join(dest, file));
}
console.log(`Installed ${id} into ${dest}`);
console.log("In Obsidian: open the vault folder, Settings → Community plugins → turn on community plugins, enable \"2027 Scoreboard\".");
