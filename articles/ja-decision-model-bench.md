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

https://masseater.dev/decision-bench

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
なければ作ってみよう、ということで、勉強がてら作ってみました。

## 作ってみた

### JNLI は 200 件から全件にした

初版の JNLI は 200 件でした。結果に 95% 信頼区間を付けると、正解率 70% 付近で ±6 ポイントほどの幅があり、モデル同士の差を見分けられませんでした。JNLI は人手の正解があるので件数を増やしても正解を付ける費用がかからず、valid の 2,434 件すべてに増やしました。

### 業務ルール判定は作り直した

初版は「条文 1 つと事例 1 つ」を渡す形でした。この形では「第 n 条」が飾りで、条文の組み合わせや例外を読む力を測れていませんでした。

そこで、既存の decision model ベンチ(Jev Decision Index、[S1MB](https://github.com/hotchpotch/S1MB)、[DecideBench](https://github.com/choyiny/decidebench)、[JevBench](https://github.com/fstandhartinger/jevbench)、[Arize の比較](https://arize.com/blog/decision-model-benchmark/)、[AIM-Decision](https://aimultiple.com/system-one))を調べました。規程全体に対する適合判定はどれにもなく、DecideBench の「ほぼ同じ 2 つの事例の 1 か所だけを変えて答えを逆にした対にする」という作り方を取り入れました。話題語への反応ではなく、条文の読みを測るためです。規程は 1 テーマにつき 8〜12 条にして毎回全体を読ませ、事例は 2 つ以上の条を組み合わせないと判断できないものにしています。

作り直す前後で同じモデル(span-01 lite)を測ると、skill は 40.9 から 12.2 に下がりました。

### hard の基準を増やした

本来ベンチマークは人間がちゃんとチェックすべきですが、流石に嫌なので、業務ルール判定のテストケースの作成は [Claude Opus 5.5](https://www.anthropic.com/claude/opus)(effort high)にやらせちゃってます。[Opus の日本語性能はかなりトップクラス](https://nejumi.ai)(Nejumi LLM リーダーボードでは前世代の Opus 5 が首位)なので参考にはなると思いますが、あくまで個人が試しに適当に作ってみた程度のものだということはご承知おきください。

正解は、1 問ごとに `claude -p` を構造化出力で 3 回独立に呼んで付けています。3 回とも一致した問題だけを採点に使い、割れた問題は「hard」として別集計にする設計でした。

ところが実際に回すと、票が割れたのは 1 件だけで、hard が機能しませんでした。そこで、作るときに意図した答え(対の片方が適合、もう片方が不適合)と多数決が食い違う問題も hard に入れるようにしました。

業務ルール判定のスコアは「Opus 5.5 との一致率」でしかありません。目安として、JNLI で Opus 5.5 のラベルと人の正解を比べた一致率(91.5%)も出しています。

### 採点は既存ベンチに揃えた

初版の採点は正解率だけでした。既存ベンチを調べた際に、採点を Jev Decision Index のルールに揃えました。未対応やエラーは 0 点で分母に入れて答えた割合は coverage として別に出し、ランダムに答えたときを 0 にした skill で比べ、費用と速度はスコアに混ぜず別の軸で見せています。

一方で、どのベンチにも書かれていなかったのが、span-01 系のように「はい / いいえ」しか受け付けないモデルに 3 択の JNLI をどう解かせるかです。ルール通り未対応を 0 点にすると、JNLI は全問が未対応の失敗になり、span-01 lite の結果が出ません。選択肢ごとに「はい / いいえ」で聞いて確率が最大のものを答えにする独自の手順をとり、結果では `*` を付けて区別しています。

## まとめ

結果として、span-01 lite はベンチで最下位(両タスクとも skill 11〜12)でした。jev-lint では、UI 状態を持たない純粋関数を「UI 状態の扱いの規約違反」と誤検知して CI が落ちていました。span-01 lite に違反例と違反でない例を判定させると、両者をほとんど区別できませんでした。lint の設定は緩めず、そのルールの判定だけをベンチで 1 位だった [Decider V1.1 27B](https://openrouter.ai/perplexity/pplx-decider-v1.1-27b) に切り替えたところ、Decider は違反例を違反と判定し、既存の 95 ファイルはすべて違反なしと判定しました。

また、自然文で書いたルールを decision model に判定させる [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) プラグイン([oxlint-plugin-decision](https://github.com/masseater/oxlint-plugin-decision))も作っている最中です。
