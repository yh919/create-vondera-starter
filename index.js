#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import ora from 'ora';
import chalk from 'chalk';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('create-vondera-starter')
  .description('Scaffold a new Vondera e-commerce project')
  .version('1.0.0')
  .argument('[project-name]', 'Name of the project')
  .option('--no-install', 'Skip dependency installation')
  .option('--template <type>', 'Template to use (default: next)', 'next')
  .action(async (projectName, options) => {
    let name = projectName;

    if (!name) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'What is your project name?',
          default: 'my-vondera-app',
          validate: (input) => {
            if (/^([a-z\-\_\d])+$/.test(input)) return true;
            return 'Project name may only include letters, numbers, underscores and hashes.';
          },
        },
      ]);
      name = answers.name;
    }

    const targetDir = path.join(process.cwd(), name);

    if (fs.existsSync(targetDir)) {
      console.error(chalk.red(`Error: Directory ${name} already exists.`));
      process.exit(1);
    }

    console.log(chalk.cyan(`\nCreating a new Vondera project in ${chalk.bold(targetDir)}.\n`));

    const spinner = ora();

    try {
      // 1. Copy Template
      spinner.start('Copying template files...');
      await copyTemplate(name, targetDir);
      spinner.succeed('Template files copied.');

      // 2. Replace Variables
      spinner.start('Customizing project...');
      await replaceVariables(name, targetDir);
      spinner.succeed('Project customized.');

      // 3. Initialize Git
      spinner.start('Initializing git repository...');
      initGit(targetDir);
      spinner.succeed('Git repository initialized.');

      // 4. Install Dependencies
      if (options.install) {
        spinner.start('Installing dependencies (this may take a minute)...');
        installDependencies(targetDir);
        spinner.succeed('Dependencies installed.');
      } else {
        console.log(chalk.yellow('\nSkipping dependency installation.'));
      }

      // Success Message
      console.log(`\n${chalk.green('Success!')} Created ${chalk.bold(name)} at ${targetDir}`);
      console.log('\nInside that directory, you can run several commands:');
      console.log(`\n  ${chalk.cyan('npm run dev')}`);
      console.log('    Starts the development server.');
      console.log(`\n  ${chalk.cyan('npm run build')}`);
      console.log('    Builds the app for production.');
      console.log('\nWe suggest that you begin by typing:');
      console.log(`\n  ${chalk.cyan('cd')} ${name}`);
      console.log(`  ${chalk.cyan('npm run dev')}\n`);
      console.log(chalk.blue('Happy coding!\n'));

    } catch (error) {
      spinner.fail('An error occurred during project creation.');
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

async function copyTemplate(projectName, targetDir) {
  const templateDir = path.join(__dirname, 'template');
  await fs.copy(templateDir, targetDir);
}

async function replaceVariables(projectName, targetDir) {
  const filesToProcess = [
    'package.json',
    'README.md',
  ];

  for (const file of filesToProcess) {
    const filePath = path.join(targetDir, file);
    if (await fs.pathExists(filePath)) {
      let content = await fs.readFile(filePath, 'utf8');
      
      // Replace project name in package.json
      if (file === 'package.json') {
        const pkg = JSON.parse(content);
        pkg.name = projectName;
        pkg.version = '0.1.0';
        pkg.description = `A fresh Vondera e-commerce project: ${projectName}`;
        delete pkg.bin; // Remove CLI bin entry if it was copied (it shouldn't be, but safe to check)
        content = JSON.stringify(pkg, null, 2);
      } else {
        // Generic replacement for other files
        content = content.replace(/vondera-ecommerce-public/g, projectName);
        content = content.replace(/Vondera Ecommerce/g, projectName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '));
      }

      await fs.writeFile(filePath, content, 'utf8');
    }
  }
}

function installDependencies(targetDir) {
  execSync('npm install', { cwd: targetDir, stdio: 'ignore' });
}

function initGit(targetDir) {
  try {
    execSync('git init', { cwd: targetDir, stdio: 'ignore' });
    execSync('git add -A', { cwd: targetDir, stdio: 'ignore' });
    execSync('git commit -m "Initial commit from create-vondera-starter"', { cwd: targetDir, stdio: 'ignore' });
  } catch (e) {
    // Git might not be installed or configured
  }
}

program.parse(process.argv);
