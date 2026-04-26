# create-vondera-starter

A production-ready CLI tool to scaffold new Vondera e-commerce projects.

## Usage

You can run this tool using `npx`:

```bash
npx create-vondera-starter my-new-store
```

Or run it interactively:

```bash
npx create-vondera-starter
```

### Options

- `--template <type>`: Choose a template (currently only `next` is supported, which maps to the Vite/React starter).
- `--no-install`: Skip the automatic `npm install` step.

## Project Structure

- `index.js`: The CLI entry point and logic.
- `template/`: The clean project files that will be copied to new projects.
- `package.json`: CLI metadata and dependencies.
