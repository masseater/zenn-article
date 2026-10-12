---
name: setup-github
description: このテンプレートから作ったリポジトリの GitHub 側を gh で設定する。Actions の secrets、Actions による PR 作成の許可、PR を作れる人の制限、既定ブランチのルールセットを揃える。テンプレートから新しいリポジトリを作ったとき、GitHub の設定を揃え直すときに使う。
---

# GitHub の設定

設定はすべて `gh` で行う。対象リポジトリを `REPO=<owner>/<name>` とする。
どの手順も、同じ値で何度実行しても結果が変わらない。

## 1. secrets を登録する

値はユーザーに尋ねる。

```sh
gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo "$REPO"
```

| 名前                      | 用途                                       |
| ------------------------- | ------------------------------------------ |
| `CLAUDE_CODE_OAUTH_TOKEN` | verify 失敗時に Claude Code が自動修正する |

Organization のリポジトリなら、Organization の secrets に一度登録すれば、各リポジトリでの登録は要らない。

## 2. Actions に PR の作成を許可する

自動修正が PR を作るためである。

```sh
gh api --method PUT "repos/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true
```

## 3. PR を作れる人を collaborator に限る

```sh
gh api --method PATCH "repos/$REPO" -f pull_request_creation_policy=collaborators_only
```

## 4. 既定ブランチを保護する

既定ブランチの削除と force push を禁じるルールセットを作る。
同じ名前のルールセットがあれば作らない。

```sh
gh api "repos/$REPO/rulesets" --jq '.[].name' | grep -qx 'protect default branch' ||
  gh api --method POST "repos/$REPO/rulesets" --input - <<'JSON'
{
  "name": "protect default branch",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [{ "type": "deletion" }, { "type": "non_fast_forward" }]
}
JSON
```

## 5. 反映を確かめる

`gh api "repos/$REPO" --jq .pull_request_creation_policy` が `collaborators_only` を返すことを確かめる。
`gh api "repos/$REPO/rulesets" --jq '.[].name'` に `protect default branch` があることも確かめる。
