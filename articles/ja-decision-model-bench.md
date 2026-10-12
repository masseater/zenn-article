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

結果そのものはサイトを見てもらうとして、この記事では作ったきっかけと、作ってみて分かったことを書きます。

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

なければ作ってみよう、ということで、勉強がてら作ってみました。結果として、英語よりも日本語のときの性能低下が顕著なことが分かったので、やってみて良かったなと思っています。

## 作ってみて分かったこと

- **タスクによって順位がかなり入れ替わる**
  - [JNLI](https://github.com/yahoojapan/JGLUE) では上位がほぼ横並びだが、規程を読ませる業務ルール判定では差が大きく開いた
  - JNLI では中位以下の [Solar Decide](https://openrouter.ai/upstage/solar-decide) が、業務ルール判定では 2 位だった
- **速度の差が桁違いのモデルがある**
  - 多くのモデルは 1 判定 200〜500 ms 程度
  - Solar Decide は業務ルール判定で p50 が約 18.7 秒、p95 が約 29 秒
- **確信度が当てにならないモデルがある**
  - span-01 lite は業務ルール判定で、確信度が上がっても正解率がほとんど上がらず、キャリブレーション曲線の全点が対角線より下(過信)だった
- **有料版と無料版が同じものを返していた**
  - 有料の [span-01](https://openrouter.ai/respan/span-01) と無料の span-01 lite は、全 2,934 問で答えも確率も完全に一致した

## まとめ

結果として、

- span-01 lite はベンチで最下位(両タスクとも skill 11〜12)
- jev-lint では、UI 状態を持たない純粋関数を「UI 状態の扱いの規約違反」と誤検知して CI が落ちた
- span-01 lite に違反例と違反でない例を判定させると、両者をほとんど区別できなかった
- lint の設定は緩めず、そのルールの判定だけをベンチで 1 位だった [Decider V1.1 27B](https://openrouter.ai/perplexity/pplx-decider-v1.1-27b) に切り替えた
- Decider は違反例を違反と判定し、既存の 95 ファイルはすべて違反なしと判定した

また、自然文で書いたルールを decision model に判定させる [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) プラグイン([oxlint-plugin-decision](https://github.com/masseater/oxlint-plugin-decision))も作っている最中です。
