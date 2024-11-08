# Cursor Chat Reader

Read and analyze VSCode CursorAI chat backups.

## Overview

This tool helps you preserve and analyze your conversations with CursorAI. It processes chat history from VSCode's database backups, extracts meaningful content, and saves it in a readable markdown format with added analytics.

### How it works

1. The tool reads SQLite database files from CursorAI backups
2. Analyzes conversations using natural language processing:
   - Identifies programming languages and technologies mentioned
   - Categorizes discussions (debugging, architecture, learning, etc.)
   - Extracts frequent terms while filtering out common words
   - Counts code blocks and other content statistics
3. Saves each conversation as a markdown file with metadata and tags

### Analysis Components

- **Content Analysis One**: Tracks code blocks, lists, and text volume in conversations
- **Context Analysis Two**: Detects technologies and conversation categories
- **Term Extraction**: Identifies important terms while filtering out common words using stop-words lists
- **Stop Words**: Maintains lists of common technical terms and words in both English and Russian that should be excluded from analysis to focus on meaningful content

## Setup

Before running the script, copy all `state.vscdb.backup` files from your Cursor backup directory to the `backup` folder:

- Windows: `%AppData%\Cursor\Backups`
- macOS: `~/Library/Application Support/Cursor/Backups`
- Linux: `~/.config/Cursor/Backups`

When copying multiple backup files, allow your system to automatically rename duplicates (e.g., `state.vscdb.backup`, `state.vscdb.backup (1)`, etc.). This ensures all chat history is preserved.

## Usage

```bash
npm install
npm start
```

## Configuration

You can configure the script by editing the `chatreader.config.js` file:
- Adjust minimum text length for saving conversations
- Modify maximum number of terms to extract
- Customize file naming templates
- Configure directories for backups and output

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
