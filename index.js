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

const BANNER = `
           ,---.           ,---,            
          /__./|   ,---.  ,---.'|          
     ,-.       /___/ \\  | | /   /   |,--.'|'   | 
'  | |' | ,--.--.                \\   ;  \\ ' |.   ; ,. :|   |  ,"' |,--.__| |  /     \\ |  |   ,'/       \\
   \\   \\  \\: |'   | |: :|   | /  | | /   ,'   |/    /  |'  :  / .--.  .-. |
     ;   \\  ' .'   | .; :|   | |  | |.   '  /  |.    ' / ||  | '   \\__\\/: . .
        \\   \\   '|   :    ||   | |  |/ '   ; |:  |'   ;   /|;  : |   ," .--.; |
                 \\   \`  ; \\   \\  /|   | |--'  |   | '/  ''   |  / ||  , ;  /  /  ,.  |
                 :   \\ |  \`----'|   |/      |   :    :||   :    | ---'  ;  :   .'   \\
                  '---"           '---'      \\   \\  /   \\   \\  /        |  ,     .-./
                                              \`----'     \`----'          \`--\`---'
`;

program
  .name('create-vondera-starter')
  .description('Scaffold a new Vondera e-commerce project')
  .version('1.2.2')
  .argument('[project-name]', 'Name of the project')
  .option('--no-install', 'Skip dependency installation')
  .option('--template <type>', 'Template to use (default: next)', 'next')
  .action(async (projectName, options) => {
    console.log(chalk.cyan(BANNER));
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What is your project name?',
        default: 'my-vondera-app',
        when: () => !projectName,
        validate: (input) => {
          if (/^([a-z\-\_\d])+$/.test(input)) return true;
          return 'Project name may only include letters, numbers, underscores and hashes.';
        },
      },
      {
        type: 'input',
        name: 'storeName',
        message: 'What is your store name?',
        default: (answers) => {
          const name = projectName || answers.name;
          return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        },
        validate: (input) => {
          if (input.trim().length > 0) return true;
          return 'Store name is required.';
        },
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'Enter your Vondera API Key:',
        validate: (input) => {
          if (input.trim().length > 0) return true;
          return 'API Key is required to make the store work.';
        },
      },
    ]);

    const name = projectName || answers.name;
    const apiKey = answers.apiKey;
    const storeName = answers.storeName;

    const targetDir = path.join(process.cwd(), name);

    if (fs.existsSync(targetDir)) {
      console.error(chalk.red(`\nError: Directory ${name} already exists.`));
      process.exit(1);
    }

    console.log(chalk.cyan(`\nCreating a new Vondera project in ${chalk.bold(targetDir)}.\n`));

    const spinner = ora();

    try {
      // 1. Copy Template
      spinner.start('Copying template files...');
      await copyTemplate(name, targetDir);
      spinner.succeed('Template files copied.');

      // 2. Replace Variables & Create .env
      spinner.start('Customizing project...');
      await replaceVariables(name, targetDir, apiKey, storeName);
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
      console.log(chalk.gray(`Configured Vondera API Key and Store Name`));
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

async function replaceVariables(projectName, targetDir, apiKey, storeName) {
  // 1. Create .env file from apiKey
  const envPath = path.join(targetDir, '.env');
  await fs.writeFile(envPath, `VITE_VONDERA_API_KEY=${apiKey}\n`, 'utf8');

  // 2. Define files to process
  // We'll process package.json, README.md, index.html and all files in src
  const filesToProcess = [
    'package.json',
    'README.md',
    'index.html',
    'API_DOCUMENTATION.md'
  ];

  // Helper to get all files in a directory recursively
  const getAllFiles = (dirPath, arrayOfFiles) => {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach((file) => {
      if (fs.statSync(dirPath + "/" + file).isDirectory()) {
        arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
      } else {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    });
    return arrayOfFiles;
  };

  const srcFiles = fs.existsSync(path.join(targetDir, 'src')) 
    ? getAllFiles(path.join(targetDir, 'src')) 
    : [];
  
  const allFiles = [
    ...filesToProcess.map(f => path.join(targetDir, f)),
    ...srcFiles
  ];

  for (const filePath of allFiles) {
    if (await fs.pathExists(filePath)) {
      // Skip binary files (roughly)
      if (filePath.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|ttf|eot)$/i)) continue;

      let content = await fs.readFile(filePath, 'utf8');
      
      const fileName = path.basename(filePath);

      // Special handling for package.json
      if (fileName === 'package.json' && filePath === path.join(targetDir, 'package.json')) {
        const pkg = JSON.parse(content);
        pkg.name = projectName;
        pkg.version = '0.1.0';
        pkg.description = `${storeName} - A fresh Vondera e-commerce project`;
        delete pkg.bin; 
        content = JSON.stringify(pkg, null, 2);
      } else {
        // Generic replacements
        // 1. Replace project identifier
        content = content.replace(/vondera-ecommerce-public/g, projectName);
        
        // 2. Replace Store Name (order matters)
        content = content.replace(/Vondera Ecommerce/g, storeName);
        content = content.replace(/Vondera Clothing Brand/g, storeName);
        content = content.replace(/VONDERA/g, storeName.toUpperCase());
        
        // 3. Replace "Vondera" with store name, but only if it's not part of an identifier like VonderaProduct
        // Using word boundary \b
        content = content.replace(/\bVondera\b/g, storeName);
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
