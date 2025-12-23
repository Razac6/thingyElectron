import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';

const rootPkgPath = path.resolve(__dirname, '../../package.json');
const appPkgPath = path.resolve(__dirname, '../../release/app/package.json');

const readJson = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`File not found: ${filePath}`));
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

const writeJson = (filePath: string, data: any) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(chalk.green(`Updated ${path.relative(path.join(__dirname, '../../'), filePath)}`));
};

const rootPkg = readJson(rootPkgPath);
const appPkg = readJson(appPkgPath);

console.log(chalk.cyan('--- Thingy Version Manager ---'));
console.log(`Current Root Version: ${chalk.yellow(rootPkg.version)}`);
console.log(`Current App Version:  ${chalk.yellow(appPkg.version)}`);

if (rootPkg.version !== appPkg.version) {
  console.log(chalk.red('Warning: Versions are out of sync!'));
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question(chalk.blue('\nEnter new version (e.g., 1.0.1): '), (input) => {
  const newVersion = input.trim();
  
  if (!newVersion) {
    console.log(chalk.yellow('Operation cancelled.'));
    rl.close();
    process.exit(0);
  }

  // Validation: Check for simple x.y.z format
  // Using a simpler check that allows multiple digits
  if (!/^\d+\.\d+\.\d+/.test(newVersion)) {
    console.error(chalk.red(`Invalid version format: "${newVersion}". Expected x.y.z`));
    rl.close();
    process.exit(1);
  }

  rootPkg.version = newVersion;
  appPkg.version = newVersion;

  writeJson(rootPkgPath, rootPkg);
  writeJson(appPkgPath, appPkg);

  console.log(chalk.green(`\nSuccessfully bumped version to ${chalk.bold(newVersion)} 🚀`));
  rl.close();
});
