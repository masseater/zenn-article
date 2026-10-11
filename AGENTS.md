<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `pnpm exec intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm exec intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## 環境変数と認証

- 環境変数は必要最小限にする。環境変数が一つ増えるだけで、どの環境で何を設定するかという考慮事項が爆発的に増えるためである。
- 環境変数にしてよいのは、設定や認証に限らず、本当に環境ごとに変わる値だけである。環境で変わらない値はコードや設定ファイルに書き、ツールにフラグがあればフラグを使う。

## レビューとCI

- PRのレビューは行わない。PRは作ったらすぐマージする。
- PR単位のCIは走らせない。`pull_request` トリガーのワークフローを追加しない。
- CIは既定ブランチ（master）へのpushで必ず走らせる。ワークフローは `.github/workflows/verify.yml` である。
- 記事の公開は、Zenn の GitHub 連携が master への push を同期して行う。CI のジョブではデプロイしない。
- マージ前の確認は手元の `vp run verify` で行う。
- PRごとの公開や確認はしない。表示の確認は手元の `vp run preview` と、master にマージして同期された Zenn 上で行う。
- Claude のクラウドセッションではプロキシが GitHub API を拒むため、`actions-lint` タスク（`vite.config.ts`）は `CLAUDE_CODE_REMOTE` が設定されていると zizmor に `--no-online-audits` を付け、オフライン監査だけを行う。フックにも渡る環境変数で切り替えるため、Stop フックの verify でも同じになる。オンライン監査は master の CI（`.github/workflows/verify.yml`）が担う。

## Zenn

- `articles/`・`books/`・`images/` は Zenn の GitHub 連携が読む場所なので、リポジトリのルートに置く。
- 記事は `vp run new:article` で作り、`vp run preview` で表示を確かめる。
- frontmatter が `published: true` の記事は、master にマージした時点で公開される。下書きは `published: false` のまま置く。
- 記事も `markdown-lint` タスク（textlint と yomiyasu）の検査対象である。

## 計測

- 推測するな、計測しろ。仮説を立てたら、実装や修正の前に計測で事実を確かめ、その結果だけで判断する。
- 不具合の調査は `systematic-debugging`、完了の確認は `verification-before-completion` スキルに従う。

## ベース

- このリポジトリのベースは https://github.com/masseater/typescript-template である。テンプレート由来の構成・方針はテンプレートに従う。
