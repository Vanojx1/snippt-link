# snippt.link

> 📋 Share code snippets instantly via URL. No server, no signup, just code.

A serverless code snippet sharing tool where **all code is stored directly in the URL**. Built with Monaco Editor (VS Code's editor) for professional-grade syntax highlighting.

## ✨ Features

- **URL-based storage** - Code is compressed and encoded in the URL hash
- **27+ languages** - Auto-detection via highlight.js + manual selection
- **Offline support** - Works without internet after first load
- **Read-only sharing** - Double-tap to edit received snippets
- **VS Code themes** - Professional dark mode syntax highlighting
- **Zero backend** - Static site, no data stored anywhere

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## 🌐 Deployment

Deployed automatically to GitHub Pages via GitHub Actions on push to `main`.

**Live at:** https://vanojx1.github.io/snippt-link/

## 📦 Tech Stack

| Library | Purpose | Size |
|---------|---------|------|
| Monaco Editor | Code editor (VS Code) | ~13MB |
| highlight.js | Language auto-detection | ~30KB |
| lz-string | URL compression | ~5KB |

## 🔧 Supported Languages

Auto-detection + manual selection for:

`c`, `cpp`, `csharp`, `css`, `dockerfile`, `go`, `html`, `java`, `javascript`, `json`, `kotlin`, `markdown`, `objective-c`, `php`, `plaintext`, `powershell`, `python`, `ruby`, `rust`, `scala`, `scss`, `shell`, `sql`, `swift`, `typescript`, `xml`, `yaml`

## 📝 How It Works

1. **Write code** → Monaco editor with syntax highlighting
2. **Auto-detect** → highlight.js identifies the language
3. **Compress** → lz-string compresses code to ~60% smaller
4. **URL encode** → Code stored in URL hash fragment
5. **Share** → Copy URL, recipient sees your code instantly

## ⚠️ URL Limits

- **Warning at 2000 chars** - May not work in all browsers
- **Error at 8000 chars** - Too long to share reliably

## 📄 License

MIT
