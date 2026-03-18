---
title: "Claude Code の .agents/ ディレクトリを git worktree から解放する"
emoji: "🔗"
type: "tech"
topics: [claude-code, git, git-worktree, gwq]
published: false
---

## tl;dr

`.agents/` の実体を `~/.project-agents-dir/{org}/{repo}/` に集約し、各 worktree からは symlink で参照するようにした。これを git hook と Claude Code hook で自動化した。

## 環境

- Claude Code 2.1.78
- git 2.43.0
- [gwq](https://github.com/d-kuro/gwq) 0.0.15

## 課題

自分は Claude Code のマルチエージェント開発時に `.agents/` へワークスペースの記録や計画ファイルを集約するようにしている。plan ファイルも `plansDirectory` で `.agents/plans/` に向けている。

これは単一ブランチなら問題ないが、git worktree を使い始めると worktree ごとに `.agents/` が分散するし、worktree を消せばデータも消える。`.agents/` はタスクをまたいで共有したい場所なので、これでは困る。

## 全体構成

`.agents/` の実体を `~/.project-agents-dir/{org}/{repo}/` に置き、プロジェクトルートには symlink だけ残す。`{org}/{repo}` は `git remote get-url origin` から抽出するので、同じリポジトリならどの worktree からでも同じデータを参照する。

```
~/.claude/
├── hooks/
│   ├── project-agents-link.sh   ← 共通ロジック（org/repo 抽出 + symlink 作成）
│   └── worktree-create.sh       ← Claude Code の WorktreeCreate hook
└── settings.json                ← worktree-create.sh の登録

~/.config/git/
├── hooks/
│   └── post-checkout            ← git worktree add / clone 時に発火
└── ignore                       ← .agents/ をグローバルに無視

~/.project-agents-dir/
└── {org}/{repo}/                ← .agents/ の実体
```

`post-checkout` と `worktree-create.sh` の両方が `project-agents-link.sh` を source して symlink を張る。`post-checkout` は `core.hooksPath` でグローバル適用、`worktree-create.sh` は Claude Code の `settings.json` から呼ぶ。

## 実装

### `project-agents-link.sh`

org/repo の抽出と symlink 作成を行う。既存の実ディレクトリがあったので、これは `rsync` で移行した。

```bash:~/.claude/hooks/project-agents-link.sh
#!/bin/bash
PROJECT_AGENTS_BASE="$HOME/.project-agents-dir"

extract_org_repo() {
    local dir="$1"
    local url
    url=$(git -C "$dir" remote get-url origin 2>/dev/null) || return 1
    echo "$url" | sed -E 's#^(https?://[^/]+/|git@[^:]+:)##; s#\.git$##'
}

ensure_project_agents_link() {
    local target_dir="${1:-.}"
    target_dir=$(cd "$target_dir" && pwd)

    local org_repo
    org_repo=$(extract_org_repo "$target_dir") || {
        echo "Warning: No git remote origin found in $target_dir, skipping .agents link" >&2
        return 1
    }

    local agents_store="$PROJECT_AGENTS_BASE/$org_repo"
    local agents_link="$target_dir/.agents"

    mkdir -p "$agents_store"

    if [ -L "$agents_link" ]; then
        local current_target
        current_target=$(readlink "$agents_link")
        if [ "$current_target" = "$agents_store" ]; then
            return 0
        fi
        rm "$agents_link"
    elif [ -d "$agents_link" ]; then
        echo "Migrating existing .agents/ to $agents_store" >&2
        rsync -a --ignore-existing "$agents_link/" "$agents_store/"
        rm -rf "$agents_link"
    fi

    ln -s "$agents_store" "$agents_link"
    echo "Linked $agents_link -> $agents_store" >&2
}
```

### `post-checkout`

`git worktree add` や `git clone` 時に自動で symlink を作る。

```bash:~/.config/git/hooks/post-checkout
#!/bin/bash
LINK_SCRIPT="$HOME/.claude/hooks/project-agents-link.sh"
[ -f "$LINK_SCRIPT" ] || exit 0

source "$LINK_SCRIPT"
ensure_project_agents_link "$(pwd)" 2>/dev/null

exit 0
```

`core.hooksPath` でグローバルに適用する。

```bash
git config --global core.hooksPath ~/.config/git/hooks
```

### `worktree-create.sh`

`WorktreeCreate` イベントで [gwq](https://github.com/d-kuro/gwq) による worktree 作成と symlink を同時にやる。

```bash:~/.claude/hooks/worktree-create.sh
#!/bin/bash
INPUT=$(cat)
NAME=$(echo "$INPUT" | jq -r '.name // ""')

[ -z "$NAME" ] && { echo "Error: No name provided" >&2; exit 1; }

BRANCH="worktree-${NAME}"

gwq add -b "$BRANCH" >&2 || { echo "Error: gwq add failed" >&2; exit 1; }

WORKTREE_PATH=$(git worktree list --porcelain 2>/dev/null | awk -v branch="refs/heads/$BRANCH" '
    /^worktree / { path=$2 }
    $0 == "branch " branch { print path; exit }
')

[ -z "$WORKTREE_PATH" ] && { echo "Error: Could not find worktree path" >&2; exit 1; }

source "$HOME/.claude/hooks/project-agents-link.sh"
ensure_project_agents_link "$WORKTREE_PATH"

echo "$WORKTREE_PATH"
```

`settings.json` に追加:

```json
{
  "hooks": {
    "WorktreeCreate": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/worktree-create.sh"
          }
        ]
      }
    ]
  }
}
```

### gitignore

`~/.config/git/ignore` に追加してグローバルに無視する。

```text:~/.config/git/ignore
.agents/
```

## `core.hooksPath` の罠

最初は `.git/hooks/post-checkout` に置いたが発火しなかった。`core.hooksPath` が設定されていると `.git/hooks/` は完全に無視される。逆に `core.hooksPath` に置けば全リポジトリに一括適用できる。

## まとめ

symlink 1 本で `.agents/` を worktree から切り離せるようにした。git の `post-checkout` と Claude Code の `WorktreeCreate` で自動化しておけば、あとは何も意識しなくていい。

なお Claude Code の `--worktree` オプションではブランチ名を指定できず、ランダムな prefix になってしまう。自分は gwq でブランチ名を制御したいので `WorktreeCreate` hook でカスタムしているが、Claude Code が渡す name 自体がランダムなので根本的な解決にはなっていない。
