# AI Contributor Guidelines

This repository contains an Angular 19 application that renders `.wdoc` files. A `.wdoc` is a zip archive that must contain an `index.html` at the root. The goal is to replace PDF documents with this zipped HTML format to simplify templating, distribution, and readability by humans and LLMs.

## Development and Testing

- Follow the project's `.editorconfig` (2‑space indentation; TypeScript uses single quotes).
- Add tests for new features when practical.
- Run the unit tests before committing:

  ```bash
  npm test
  ```

  The tests rely on a Chrome browser. If Chrome is not installed, set the `CHROME_BIN` environment variable appropriately.

## Feature Roadmap

When implementing new functionality, keep in mind the planned roadmap:

1. Support `<form>` elements in `.wdoc` files and store form results in a `wdoc-form` directory.
2. Allow forms to accept file uploads (e.g., a visa request photo).
3. Provide e‑signature capabilities both for the document and for submitted form data.
4. Implement automatic page splitting for common HTML pages.

