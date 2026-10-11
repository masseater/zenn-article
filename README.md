# zenn-article

[Zenn](https://zenn.dev/) の記事と本の原稿。
Zenn の GitHub 連携で、master ブランチの `articles/`・`books/` が Zenn に同期される。

## セットアップ

```sh
vp install
vp run verify
```

## 記事を書く

```sh
vp run new:article
vp run preview
```

frontmatter の `published: true` の記事は、master にマージした時点で公開される。
書き方は [Zenn CLI の使い方](https://zenn.dev/zenn/articles/zenn-cli-guide) にある。

## GitHub の設定

Actions の secrets、Actions による PR 作成の許可、PR を作れる人の制限、既定ブランチのルールセットを gh で設定する。
手順は `setup-github` スキル（`docs/skills/setup-github/SKILL.md`）にある。
