---
title: "decision model の日本語性能ベンチマークを勉強がてら作ってみた"
emoji: "⚖️"
type: "tech"
topics: ["jev", "decisionmodel", "llm", "benchmark", "openrouter"]
published: false
---

## はじめに

選択・二値・スコアだけを返す「decision model」を、日本語のタスクで測るベンチマークを勉強がてら作りました。

結果の公開サイトはこちらです。

https://mst-ja-decision-bench.masseater.dev

コードはこちらです。

https://github.com/masseater/mst-ja-decision-bench

結果そのものはサイトを見てもらうとして、この記事では作ったきっかけと、どう作ったかを書きます。

![概要ページ](/images/ja-decision-model-bench/top.png)

## 作ったきっかけ

decision model は、文章を生成せずに「どれを選ぶか」「はい / いいえの確率」だけを返すモデルです。2026 年 9 月 15 日に [TypeSafe](https://typesafe.ai) が [Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) をリリースしてから世界的なブームになり、各社が色んなモデルを出しています。

自分はタイムラインや友人がワイワイしているのを見て数日遅れで使い始めたのですが、使ってみてめちゃくちゃ革命を感じました。その革命に感動し、とりあえず [Claude Code](https://code.claude.com/docs) のハーネスに Jev を組み込み始めました。[jev-lint](https://github.com/mizchi/jev-lint)、[jev-pruner](https://github.com/tamaratran/jev-pruner)、[fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction)、[jevgrep](https://github.com/dzhng/jevgrep) などを入れたり、自作の [cc-jev-teacher](https://github.com/masseater/cc-jev-teacher) を作ったりしています。

その中で、

- Jev は超激安だと分かってはいたものの、従量課金を使うのは心理的なハードルがあった
- そこで無料で使える [span-01 lite](https://openrouter.ai/respan/span-01-lite) で判定させていたら、Jev のときより明らかに誤検知が増えた
- 日本語での性能がどれくらい違うのかを知りたくて、日本語のベンチマークを探しに行った
- [Jev Decision Index](https://huggingface.co/spaces/multimodalart/jev-decision-index) など、decision model 向けのベンチマークはあるが、日本語のタスクがない
- 日本語でいくつかのモデルを比較してみたものはあるが、現時点の decision model をまとめて体系的に測ったものは見つからなかった

となりました。
なければ作ってみよう、ということで、勉強がてら作ってみました。結果として、英語よりも日本語のときの性能低下が顕著なことが分かったので、やってみて良かったなと思っています。

<!-- TODO: 英語との比較の根拠を入れる。mst-ja-decision-bench には英語タスクの結果がなく、Jev Decision Index などの英語のスコアと並べた数値がリポジトリにない -->

## 作ってみた

- タスクは 2 つ
  - [JNLI](https://github.com/yahoojapan/JGLUE): 2 文の関係を「含意・矛盾・中立」の 3 択で答える。valid の 2,434 件で、正解は人手ラベル
  - 業務ルール判定: 架空の会社 25 社分の社内規程(各 8〜12 条)と事例 500 件で、規程に適合しているかを二値で答える。1 か所だけ変えて答えが逆になる事例の対にしている
- 対象は [OpenRouter](https://openrouter.ai) 上の decision model 16 件
- 採点は Jev Decision Index などの既存ベンチのやり方に揃えた
- 「はい / いいえ」しか受け付けない span-01 系には、選択肢ごとに「はい / いいえ」で聞いて 3 択を解かせた。どの既存ベンチにもないやり方なので、結果では `*` を付けて区別している

本来ベンチマークは人間がちゃんとチェックすべきですが、流石に嫌なので、業務ルール判定のテストケースの作成は [Claude Opus 5.5](https://www.anthropic.com/claude/opus)(effort high)にやらせちゃってます。Opus の日本語性能はかなりトップクラス([Nejumi LLM リーダーボード](https://nejumi.ai) では前世代の Opus 5 が首位)なので参考にはなると思いますが、あくまで個人が試しに適当に作ってみた程度のものだということはご承知おきください。

## まとめ

結果として、

- span-01 lite はベンチで最下位(両タスクとも skill 11〜12)
- jev-lint では、UI 状態を持たない純粋関数を「UI 状態の扱いの規約違反」と誤検知して CI が落ちた
- span-01 lite に違反例と違反でない例を判定させると、両者をほとんど区別できなかった
- lint の設定は緩めず、そのルールの判定だけをベンチで 1 位だった [Decider V1.1 27B](https://openrouter.ai/perplexity/pplx-decider-v1.1-27b) に切り替えた
- Decider は違反例を違反と判定し、既存の 95 ファイルはすべて違反なしと判定した

となりました。
また、自然文で書いたルールを decision model に判定させる [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) プラグイン([oxlint-plugin-decision](https://github.com/masseater/oxlint-plugin-decision))も作っている最中です。
