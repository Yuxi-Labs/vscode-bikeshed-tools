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

  <!-- Version -->
  <img src="https://img.shields.io/github/package-json/v/Yuxi-Labs/vscode-bikeshed-tools" alt="Version" />
</p>


This VS Code extension enables spec developers to write, preview and build Bikeshed specifications without leaving the editor.


<img src="/assets/images/bikeshed-syntax.png" alt="bikeshed-syntax"/>

FEATURES
--------

- Syntax Highlighting  
  Makes .bs specs easier to read and less error-prone.

- Snippets & Suggestions  
  Common metadata, boilerplate, and macros—available with a keystroke.

- Hover Info  
  See explanations of Bikeshed macros and metadata without leaving your editor.

- Build Command  
  Use the command palette (“Bikeshed: Build Spec”) to generate HTML from your Bikeshed source.

- Live Preview  (Experimental)
  Instantly view the generated HTML next to your source. Preview refreshes on save.

- Error Feedback  
  Bikeshed warnings and errors appear in the VS Code output panel, so you never have to hunt in the terminal.

QUICK START
-----------

1. **Install Python and Bikeshed**  
   You must have Python installed (3.7+ recommended). Then open your terminal and run:
```bash
python3 -m pip install --upgrade bikeshed
bikeshed update
```
2. **Configure Paths (if needed)**  
   If Bikeshed isn’t globally available (e.g., you used a virtual environment), set the path in your VS Code settings (either via the Settings UI or `.vscode/settings.json`):
```bash
{
  "bikeshedTools.pythonPath": "/path/to/python",
  "bikeshedTools.bikeshedPath": "/path/to/bikeshed"
}
```
Leave either field blank to let the extension auto-detect.

3. **Create and Edit Specs**
  - Open or create a file with the `.bs` extension.
  - Add your `<pre class="metadata">` block and start editing.
  - Use the command palette (Ctrl+Shift+P or Cmd+Shift+P) and run “Bikeshed: Build Spec” to build your document.
  - To see the live HTML preview, save your `.bs` file.

TROUBLESHOOTING
---------------

- If Bikeshed or Python are not found, you’ll be prompted to select them on first use.
- Bikeshed’s cache must be updated (run `bikeshed update` in your terminal) before first use.
- Most issues can be solved by making sure Python and Bikeshed are up to date and available on your system PATH, or by setting the correct paths in your workspace settings.

KNOWN LIMITATIONS
-----------------

- Live typing speed needs improvement
- Syntax highlighting is intentionally basic; the Bikeshed language evolves fast
- Inline linting (error squiggles) is not yet implemented

ROADMAP
-------

- Inline diagnostics (error squiggles)
- Better autocomplete for macros and metadata
- Smarter, real-time preview
- Command to open generated HTML in your browser
- More complete Bikeshed grammar support

---

For support, updates, or to file issues, visit:
https://github.com/Yuxi-Labs/vscode-bikeshed-tools
