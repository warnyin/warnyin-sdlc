# /sdlc:feedback [bug|idea] <one line> — file an issue upstream

Reports a bug, a rough edge, or a missing feature in the **framework itself** to
`warnyin/warnyin-sdlc`. Bugs in the project you are working on belong in that
project's own tracker — say so and stop.

1. Collect context in one shot; never interrogate the human for it:
   - version: `npx @warnyin/sdlc version` · node: `node --version` · OS and arch
   - tool adapter: `tools:` in `sdlc/config.yaml`
   - active change id + status: `npx @warnyin/sdlc status --json`
   Any field you cannot read is `unknown` — continue, and never guess a value.
2. If the invocation carried no description, ask once, in one message: what you
   did, what you expected, what happened instead.
3. Look for it first, when `gh` is available:
   `gh issue list --repo warnyin/warnyin-sdlc --search "<keywords>" --state all --limit 5`.
   Choose `<keywords>` yourself — two to four plain words, letters/digits/hyphen
   only — never the reporter's raw sentence: it reaches the shell as an argument
   exactly like the title does. If an existing thread matches, show it and ask
   whether to comment there rather than open a duplicate.
4. Redact before the draft is shown to anyone or sent anywhere:
   - absolute paths → project-relative paths (a home directory or host name in a
     path identifies the reporter's machine and employer)
   - token-, key-, password- and connection-string-shaped values → `<redacted>`,
     and tell the human which values you removed
   - never copy the contents of `sdlc/context/constitution.md`, steering files,
     `.env` files, credential files, journals, or diffs into the report
   - this is a rule list, not a guarantee: the human reading the draft is the
     real control, so never claim the report has been fully scrubbed
5. Show the full draft — destination repo, title, labels, complete body — and ask
   for approval. No network call happens before that approval. On anything other
   than approval: revise the draft and ask again.
6. Submit, once approved:
   - `gh auth status` must report an authenticated **github.com** account; an
     enterprise-only login goes to step 7 instead of publishing to the wrong host
   - `gh issue create --repo warnyin/warnyin-sdlc --title "<title>"
     --label <bug|enhancement> --body-file -`, body on stdin
   - never pass the body as an inline `--body` argument: report text carries
     backticks, quotes and newlines — inline it breaks on PowerShell and is a
     shell-injection path straight from human-written text
   - the title is human text on a command line too: write it yourself as a plain
     summary (≤80 chars, no newline, no `` ` ``, `$`, `"`, `\`, `|`, `;`, `&`),
     never paste the reporter's words in raw. If a needed character is not
     allowed, reword the title — do not escape your way around it
   - report the resulting issue URL back
7. Fallback when `gh` is absent, logged out, or not on github.com — a normal
   path, not an error: hand over a prefilled link
   `https://github.com/warnyin/warnyin-sdlc/issues/new?labels=<label>&title=<t>&body=<b>`
   with `<t>` and `<b>` URL-encoded. If the encoded link exceeds ~6000 characters,
   truncate the body it carries and tell the human to paste the rest from the
   draft shown above.

Body shape (keep it this short — a maintainer triages it in one screen):

```
### What happened
<one paragraph, redacted>

### Expected
<one line>

### Steps
1. <command or stage>

### Environment
sdlc <version> · node <version> · <os> · adapter <tool> · change <id> [<status>]
```

Labels: `bug` for something broken, `enhancement` for an idea or a request.
Nothing else is attached — no logs, no journal, no diff.
