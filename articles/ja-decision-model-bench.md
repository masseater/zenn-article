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

結果そのものはサイトを見てもらうとして、この記事では作ったきっかけと、作るときに工夫したこと、作ってみて分かったことを書きます。

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

なければ作ってみよう、ということで、勉強がてら作ってみました。厳密さよりも、まず一通り回すことを優先しています。

## 工夫したところ

### 採点は既存ベンチに寄せた

自己流で採点せず、既存の decision model ベンチのやり方に寄せました。

| ベンチ | 取り入れた点 |
| --- | --- |
| [Jev Decision Index](https://huggingface.co/spaces/multimodalart/jev-decision-index) | 未対応・エラーは 0 点で分母に入れる、全モデル同じ問題文、NLI は macro-F1 |
| [S1MB](https://github.com/hotchpotch/S1MB) | chance 補正した skill、二値は balanced accuracy |
| [DecideBench](https://github.com/choyiny/decidebench) | 最小差分ペアと対の正解率 |
| [JevBench](https://github.com/fstandhartinger/jevbench) | p50・p95 レイテンシ、ECE と Brier |
| [Arize の比較](https://arize.com/blog/decision-model-benchmark/) | 較正誤差を別に示す |
| [AIM-Decision](https://aimultiple.com/system-one) | 費用と速度はスコアに混ぜず別の軸で示す |

特に効いているのは次の点です。

- **失敗を分母から外さない**: 答えられなかった問題を外すと、難しい問題だけ落とすモデルが得をする。未対応やエラーは 0 点にして、答えた割合は coverage として別に出す
- **skill に揃える**: 3 択と二値では偶然当たる確率が違うので、ランダムに答えたときを 0 にした値で比べる
- **信頼区間を付ける**: [JNLI](https://github.com/yahoojapan/JGLUE) は最初 200 件で回していたが、正解率 70% 付近で区間が ±6 ポイントほどあり差が見分けられなかったので、valid 全件に増やした
- **キャリブレーションも見る**: 確率から ECE と Brier を出し、確信度と実際の正解率のグラフを描く

### 業務ルール判定は最小差分ペアで作った

業務ルール判定は自作データなので、一度作り直しています。

- 最初の版は「条文 1 つと事例 1 つ」を渡す形で、条文を読まなくても事例の話題語だけで当てられる問題が多かった
- 作り直した版では次のようにした
  - 1 テーマにつき 8〜12 条の規程を作り、毎回その規程全体を読ませる
  - 事例は 2 つ以上の条を組み合わせないと判断できないものにする
  - DecideBench に倣い、ほぼ同じ 2 つの事例の 1 か所(金額、日付、役職、手続きの順序、例外の条件)だけを変えて答えを逆にした「対」にする
  - 対の両方に正解した割合を「対の正解率」として出す
- 細かい調整
  - 問いは「適合しているか」の肯定形に揃えた(Arize の比較で否定形の問いが判定の逆転を招いていたため)
  - Cloudflare の [Clef](https://openrouter.ai/cloudflare/clef) 系は入力の先頭約 2,000 トークンしか読まないので、規程は 1,500 字以内に収めた

作り直しの前後で span-01 lite を測ると、skill は 40.9 から 12.2 に下がり、対の正解率は 13.8% でした。最初の版は、規程を読む力ではなく話題語への反応を測っていたことになります。

### 正解ラベルは 3 回聞いて割れたものを分けた

業務ルール判定の正解は [Claude Opus 5.5](https://www.anthropic.com/claude/opus)(effort high)に付けさせています。

- 1 問ごとに `claude -p` を構造化出力で 3 回独立に呼ぶ
- 3 回とも一致したものだけを採点に使い、割れたものは hard として別集計にする
- ただし 500 件中で票が割れたのは 1 件だけで、hard がほとんど機能しなかった
- そこで「作るときに意図した答えと多数決が食い違う問題」も hard に入れた

業務ルール判定のスコアは「Opus 5.5 との一致率」でしかありません。目安として、JNLI では Opus 5.5 のラベルと人の正解の一致率(91.5%)も出しています。

### Noul しか受け付けないモデルにも 3 択を解かせた

span-01 系は「はい / いいえ」(Noul)しか受け付けません。Decision Index のルール通り未対応を 0 点にすると、JNLI では何も測れません。

- 選択肢ごとに「次の答えは正しいですか: 含意」のような Noul の問いを作る
- それらを 1 リクエストにまとめて送り、「はい」の確率が最大の選択肢を答えにする
- 1 件 1 呼び出しなので、費用も他のモデルと揃う

どの既存ベンチにも書かれていない独自のやり方なので、結果では `*` を付けて区別しています。

### モデルが数十に増えても成り立つようにした

decision model は [OpenRouter](https://openrouter.ai) 上の十数個がすべてではなく、今後も増えそうなので、モデル数が数十になっても破綻しない形にしています。

- 呼び出しは当面 OpenRouter の SDK([`@openrouter/sdk`](https://www.npmjs.com/package/@openrouter/sdk) の `systemOne.create`)に一本化しつつ、モデルは `{ provider: "openrouter", id: "typesafe/jev-1.13" }` のように provider を含めて持つ
- 応答は [Effect](https://effect.website) の `PersistedCache` で 1 件 1 ファイルにキャッシュし、モデルを足してもそのモデルの分だけ呼べば済むようにする
- 表はソート可能にし、既定は上位 10 件で「すべて表示」とモデル名での絞り込みを付ける
- 散布図はラベルの重なりを避け、ホバーでモデル名を出す

### 費用は実測から見積もった

- OpenRouter の API キーには月の利用上限をかけた
- 新しいモデルを回す前に、実測済みモデルのトークン数と単価から見積を出し、承認してから回す
- 新規 14 モデルを全件回したときは、見積 $1.74 に対して実費は約 $0.96 だった
- Opus 5.5 でのラベル付けは API 換算だと 30 ドルを超えるが、サブスクリプション経由の `claude -p` なので実際の請求はない
- OpenRouter の `:free` 付きモデルはアカウントのデータポリシー設定で拒否されたので、有料版を使った

## 作ってみて分かったこと

- **タスクによって順位がかなり入れ替わる**
  - JNLI では上位がほぼ横並びだが、規程を読ませる業務ルール判定では差が大きく開いた
  - JNLI では中位以下の [Solar Decide](https://openrouter.ai/upstage/solar-decide) が、業務ルール判定では 2 位だった
- **速度の差が桁違いのモデルがある**
  - 多くのモデルは 1 判定 200〜500 ms 程度
  - Solar Decide は業務ルール判定で p50 が約 18.7 秒、p95 が約 29 秒
- **確信度が当てにならないモデルがある**
  - span-01 lite は業務ルール判定で、確信度が上がっても正解率がほとんど上がらず、キャリブレーション曲線の全点が対角線より下(過信)だった
- **有料版と無料版が同じものを返していた**
  - 有料の [span-01](https://openrouter.ai/respan/span-01) と無料の span-01 lite は、全 2,934 問で答えも確率も完全に一致した

## 結局 lint は Decider に切り替えた

きっかけになった jev-lint の誤検知は、ベンチの結果とそのまま一致していました。

- span-01 lite はベンチで最下位(両タスクとも skill 11〜12)
- jev-lint では、UI 状態を持たない純粋関数を「UI 状態の扱いの規約違反」と誤検知して CI が落ちた
- span-01 lite に違反例と違反でない例を判定させると、両者をほとんど区別できなかった
- lint の設定は緩めず、そのルールの判定だけをベンチで 1 位だった [Decider V1.1 27B](https://openrouter.ai/perplexity/pplx-decider-v1.1-27b) に切り替えた
- Decider は違反例を違反と判定し、既存の 95 ファイルはすべて違反なしと判定した

## おわりに

日本語の decision model を体系的に測ったものがなかったので作ってみましたが、タスクによって順位が大きく入れ替わることや、無料モデルの誤検知がベンチでもはっきり出ることが分かりました。decision model は 1 判定あたりの費用が非常に安いので、自分の用途に近いタスクを作って測ってみるのもおすすめです。

今後は OpenRouter 以外のプロバイダの decision model も足していきたいと思っています。また、自然文で書いたルールを decision model に判定させる [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) プラグイン([oxlint-plugin-decision](https://github.com/masseater/oxlint-plugin-decision))も作っている最中です。
