# Bikeshed Tools for VS Code

<p>
  <!-- Build status -->
  <img src="https://img.shields.io/github/actions/workflow/status/Yuxi-Labs/vscode-bikeshed-tools/ci.yml?branch=production" alt="Build Status" />

  <!-- Latest Release -->
  <img src="https://img.shields.io/github/v/release/Yuxi-Labs/vscode-bikeshed-tools?include_prereleases&sort=semver" alt="Latest Release" />

  <!-- Open Issues -->
  <img src="https://img.shields.io/github/issues/Yuxi-Labs/vscode-bikeshed-tools" alt="Open Issues" />

  <!-- Pull Requests -->
  <img src="https://img.shields.io/github/issues-pr/Yuxi-Labs/vscode-bikeshed-tools" alt="Pull Requests" />

  <!-- Last Commit -->
  <img src="https://img.shields.io/github/last-commit/Yuxi-Labs/vscode-bikeshed-tools" alt="Last Commit" />

  <!-- Contributors -->
  <img src="https://img.shields.io/github/contributors/Yuxi-Labs/vscode-bikeshed-tools" alt="Contributors" />
</p>


This extension enables spec editors to author, preview and build [Bikeshed](https://tabatkins.github.io/bikeshed/) specifications without leaving VS Code.

## Features

- Syntax Highlighting  
  Makes your spec easier to scan and less soul-crushing to edit.

- Snippets & Suggestions  
  Common metadata and macros just a few keystrokes away.

- Hover Info  
  Explanations of macros and metadata without leaving the editor.

- Build Command  
  Run `Bikeshed: Build Spec` to generate your spec from `.bs` source.

- Live Preview  
  Auto-updating HTML preview side-by-side with your source. See your doc come alive on save.

- Error Feedback  
  Bikeshed errors go directly to the output panel and status bar. No more playing detective in your terminal.

## Getting Started

1. Install Bikeshed CLI  
   You need [Python](https://www.python.org) installed. Then:

   ```bash
   python3 -m pip install --upgrade bikeshed
   bikeshed update
   ```

2. Tell VS Code where to find it
   If it's not globally available (e.g., installed in a virtualenv), set the path in your settings.json:

   ```json
   {
    "bikeshedTools.bikeshedPath": "/path/to/bikeshed"
   }
   ```

3. Start Writing

   Create a .bs file and add a `<pre class="metadata">` block to begin. Use the command palette to run Bikeshed: Build Spec.

5. Known Limitations
   - Preview only updates on save (live typing is coming)
   - Syntax highlighting is basic — Bikeshed's grammar is complex and evolving
   - No inline linting... yet

6. Roadmap
    - Inline error squiggles (diagnostics)
    - Better autocomplete for macros and metadata
    - Smarter preview refresh
    - Command to open generated HTML in browser
    - Full Bikeshed grammar support
    