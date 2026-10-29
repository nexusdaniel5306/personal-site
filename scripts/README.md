# Publish a writing

Run from the repository root to convert Markdown into a site-compatible article and update `writings.html`:

```bash
python3 scripts/publish_writing.py path/to/post.md
```

The script prompts for the title, date, excerpt, and whether to push immediately.

Nothing is written until all prompts are completed. Abort with `Ctrl+C`, `Ctrl+D`, or by entering `abort`, `quit`, or `exit` to leave the site unchanged.

After the prompts, the script writes `Essay_Folder/<slug>.html` and rebuilds the writings index from the published posts in `Essay_Folder/`. The slug is derived from the title.

The index previews each article's opening paragraph, trimmed to about 160 characters with an ellipsis. The excerpt sets the article's metadata rather than the index preview.

Choosing to push immediately runs `git add`, `git commit`, and `git push origin main` with the commit message `add writing <title>`.

The script also reads title, date, and excerpt defaults from simple front matter:

```md
---
title: My Post
date: 2026-04-11
excerpt: Short summary for the article metadata
---
```

To preview the inferred output without writing files, use:

```bash
python3 scripts/publish_writing.py path/to/post.md --dry-run
```
