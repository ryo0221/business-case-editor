# 収支の道具に求めること（事業企画部 早川のメモ）

「新規事業の企画」Project の工程 6「収支計画」で使う道具です。成果物は「収支のモデル」（financial-model）で、今は表で開きますが、専用の Editor で作り・確かめ・受け入れたいと考えています。

## 工程定義（new-business-planning）から

- 成果物 financial-model「収支のモデル（NPV・IRR、3つのシナリオ、10年・年次）」。見出しは「前提」（項目 financial-assumption、ID の形 FA-{nn}）と「シナリオ」（項目 scenario、ID の形 SC-{nn}）。
- 決まり scenario.assumption：各シナリオは前提を 1 つ以上引用する。
- 受け入れ条件
  - financial-plan.review1：佐藤（経理）が経理の観点から承認する（人）。
  - financial-plan.content：10 年・年次・3 シナリオで NPV と IRR を示す。前提には実績・予測・仮定・計算の種類を付け、為替（THB）を置く。各シナリオは前提を引用する（AI が確かめる）。
- 後の工程で使う：工程 8「投資の判断」の基準（investment-criterion）は前提とリスクを引用する。スライド（工程 10）は収支の数字を引用する。

## 計画（docs/ref/shinonome-plan.md）で決めたこと

- U2：初版は 10 年・年次・3 シナリオ（基本・楽観・悲観）に絞る。基準の通貨は円で、THB の為替は前提にする。
- U4：前提の値には、実績・予測・仮定・計算の 4 種類の印を付ける。公開の統計には出所を付ける。
- 初版の範囲：前提の表 → 10 年・年次の収支、3 シナリオと感応度、NPV・IRR・回収年。結果から前提に戻れる根拠と、受け入れた版。
- 確かめ役が、収支を前提から引き直して一致を見る（数字のずれで判定する）。

## 前の工程で決まっている数字の出どころ（Project「新規事業の企画」の main）

- docs/market-research.md：MS-01..06（タイの BEV の販売台数 2024 年 66,732 台・2025 年 120,301 台、30@30 の上限 725,000 台 など）。
- docs/business-model-map.json：価値・収益の流れ（VF-01..06、RS-xx）。
- docs/execution-plan.md：拠点・物流・工場の計画（OR-01..09、ML-01..05）。

## 前の道具（マインドマップ）で分かったこと

- package の validate は、PaoBub の受け入れ前の確かめ（QuickJS）でも動く。そこには Intl・TextEncoder・crypto・DOM が無いので、読み込みと validate では使わない（画面の mount の中では使ってよい）。
- 同じ版の番号で中身の違う package は Host が断る。直したら版を上げる。
- 色や種類は、コードを打たせず選ばせる。
- Editor Platform には小数の計算と丸め（calculation-core）や、条件の保存と結果の比べ（Analysis）がある。使える所は使い、足りない所は提案する。
