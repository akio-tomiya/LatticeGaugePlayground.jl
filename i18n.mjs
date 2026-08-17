const STORAGE_KEY = 'gaugefields-lite-language';

export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'ja', 'zh-Hans']);

const translations = {
  en: {
    'app.title': 'Lattice Gauge Theory Playground',
    'meta.description': 'Explore lattice gauge theory in your browser.',
    'nav.skip': 'Skip to simulation controls',
    'language.label': 'Language',
    'header.lab': 'Gauge theory lab',
    'header.tagline': 'Lattice gauge theory in your browser.',
    'header.builtWith': 'Built with',
    'header.componentsFrom': 'and gauge-field components adapted from',
    'header.possessive': '’s',
    'settings.title': 'Simulation settings',
    'settings.gaugeGroup': 'Gauge group',
    'settings.action': 'Action',
    'settings.latticeSize': 'Lattice size',
    'settings.lattice1': '1⁴',
    'settings.lattice2': '2⁴',
    'settings.lattice4442': '4 × 4 × 4 × 2',
    'settings.lattice4': '4⁴',
    'settings.initialConfiguration': 'Initial configuration',
    'settings.cold': 'Cold',
    'settings.random': 'Random',
    'settings.algorithm': 'Algorithm',
    'settings.heatbath': 'Heatbath',
    'settings.metropolis': 'Metropolis',
    'settings.heatbathUnavailable': 'Heatbath needs every lattice extent to be at least 2. Metropolis is selected for this lattice.',
    'settings.sweeps': 'Sweeps',
    'settings.seed': 'Seed',
    'settings.sweepNote': 'Each completed sweep updates the lattice view.',
    'settings.advanced': 'Advanced settings',
    'settings.proposalStrength': 'Proposal strength ε',
    'guidance.loading': 'You can change the settings while the calculator loads.',
    'guidance.running': 'The current calculation is running. Cancel keeps completed sweeps for Continue.',
    'guidance.cancelling': 'Stopping at the next Julia/WASM chunk boundary. The saved state will be kept.',
    'guidance.savedView': 'The saved configuration is protected. Show selected plane measures the new view without adding sweeps.',
    'guidance.savedMatching': 'The saved configuration is protected. Continue adds sweeps; Start over discards it.',
    'guidance.savedMismatch': 'Physical settings differ from the saved configuration. Restore them to Continue, or Start over.',
    'summary.selectedLattice': 'Selected lattice',
    'summary.selectedAlgorithm': 'Selected algorithm',
    'summary.coldStart': 'Cold start',
    'summary.randomStart': 'Random start',
    'unit.sweepOne': '{count} sweep',
    'unit.sweepOther': '{count} sweeps',
    'unit.selectedSweeps': 'selected sweeps',
    'action.measureInitial': 'Measure initial state',
    'action.runCount': 'Run {sweeps}',
    'action.run': 'Run simulation',
    'action.showPlane': 'Show selected plane',
    'action.continue': 'Continue',
    'action.continueCount': 'Continue +{sweeps}',
    'action.startOver': 'Start over',
    'action.startOverAria': 'Start over and discard the saved simulation',
    'action.cancel': 'Cancel',
    'action.retry': 'Prepare again',
    'error.calculationTitle': 'The calculation could not be completed.',
    'error.calculationHint': 'Try a smaller lattice or fewer sweeps.',
    'error.invalidSettings': 'Check the highlighted simulation settings.',
    'error.runProtected': 'Start over before running a new simulation. The saved configuration was kept.',
    'error.sameSettings': 'This action requires the same completed physical settings.',
    'visualization.title': 'Gauge-field activity',
    'visualization.subtitle': 'Local plaquette action density on one slice',
    'visualization.view': 'View',
    'visualization.landscape': 'Landscape',
    'visualization.heatmap': 'Heatmap',
    'visualization.plane': 'Plane',
    'visualization.slice': 'Slice',
    'visualization.evolution': 'Evolution',
    'visualization.replay': 'Replay',
    'visualization.pause': 'Pause',
    'visualization.resume': 'Resume',
    'visualization.replayAria': 'Replay evolution from the beginning',
    'visualization.pauseAria': 'Pause evolution replay',
    'visualization.resumeAria': 'Resume evolution replay',
    'visualization.sliderAria': 'Select a received Monte Carlo sweep',
    'visualization.landscapeAria': 'Gauge-field activity landscape',
    'visualization.heatmapAria': 'Local plaquette action density heatmap',
    'visualization.canvasFallback': 'Gauge-field activity visualization.',
    'visualization.readyExperiment': 'Ready for an experiment',
    'visualization.chooseExperiment': 'Choose the guided experiment or set up your own run in the Lab controls.',
    'visualization.initialConfiguration': 'Initial configuration',
    'visualization.sweepProgress': 'Sweep {current} of {total}',
    'visualization.landscapeSummary': '{frame} · brighter and taller means stronger fluctuation · {plane} slice {slice} · values {actualMin} to {actualMax} · fixed range {min} to {max}',
    'visualization.heatmapSummary': '{frame} · {plane} plane · slice {slice} · values {actualMin} to {actualMax} · color scale {min} to {max}',
    'visualization.loadingSummary': 'Loading calculator… Each bar will represent one site on the selected lattice slice.',
    'visualization.resultsAfterRun': 'Results will appear here after a run.',
    'visualization.runToView': 'Run a simulation to view the lattice.',
    'visualization.calculatorUnavailable': 'Calculator unavailable',
    'visualization.unavailableSummary': 'Use Prepare again after checking the browser connection.',
    'visualization.unavailableDetail': 'Check the connection, then choose Prepare again.',
    'visualization.noHistoryZero': 'No sweep history for a 0-sweep run.',
    'visualization.historyPlaceholder': 'Plaquette history will appear here.',
    'waiting.loadingTitle': 'Loading calculator…',
    'waiting.loadingDetail': 'Review the settings while it gets ready.',
    'waiting.loadingLongTitle': 'Still loading calculator…',
    'waiting.loadingLongDetail': 'The first visit can take longer. You can keep reviewing the settings.',
    'waiting.firstChunkTitle': 'Calculating first chunk…',
    'waiting.firstChunkDetail': 'Waiting for the first lattice frame.',
    'waiting.su3Title': 'Preparing SU(3)…',
    'waiting.su3Detail': 'Setup and calculation may take longer.',
    'waiting.startingTitle': 'Starting simulation…',
    'waiting.startingDetail': 'Waiting for the first calculation chunk.',
    'waiting.continuation': 'Preparing continuation…',
    'waiting.continuationDetail': 'Continuing from the saved configuration…',
    'waiting.view': 'Updating selected plane…',
    'waiting.viewDetail': 'Measuring the saved configuration on the selected plane…',
    'status.loadingTitle': 'Loading calculator…',
    'status.loadingDetail': 'Review the settings while it gets ready. The first visit may take longer.',
    'status.loadingLongTitle': 'Still loading…',
    'status.loadingLongDetail': 'The first visit can take longer. Cached files make later visits faster.',
    'status.readyTitle': 'Ready',
    'status.readyDetail': 'Choose settings and run the calculation.',
    'status.runningTitle': 'Running…',
    'status.runningDetail': 'The page remains available while the calculation proceeds.',
    'status.initialMeasured': 'Initial configuration measured.',
    'status.errorTitle': 'Unable to complete the calculation',
    'status.errorDetail': 'Adjust the settings and try again.',
    'status.su3Title': 'Preparing SU(3)…',
    'status.su3Detail': 'Loading the selected calculation engine.',
    'status.cancelledTitle': 'Cancelled',
    'status.completedTitle': 'Completed',
    'status.viewUpdatedTitle': 'View updated',
    'status.cancelledOne': '{count} completed sweep was kept. Continue is available.',
    'status.cancelledOther': '{count} completed sweeps were kept. Continue is available.',
    'status.viewMeasured': '{plane} plane, slice {slice}, measured on sweep {count}.',
    'status.measuredOne': '{count} sweep measured.',
    'status.measuredOther': '{count} sweeps measured.',
    'status.continuingTitle': 'Continuing…',
    'status.updatingViewTitle': 'Updating view…',
    'status.startingTitle': 'Starting…',
    'status.continuingDetail': 'Adding {count} sweeps to the current configuration.',
    'status.viewKeptDetail': 'The saved configuration and sweep count will be kept.',
    'status.startingDetail': 'Preparing the selected small-lattice calculation.',
    'status.stoppingTitle': 'Stopping…',
    'status.stoppingDetail': 'The completed state will be kept for Continue.',
    'elapsed.preparingAria': 'Calculator preparation time',
    'elapsed.simulationAria': 'Elapsed simulation time',
    'elapsed.loading': 'Loading {seconds} s',
    'elapsed.elapsed': 'Elapsed {seconds} s',
    'elapsed.ready': 'Ready in {seconds} s',
    'elapsed.stopped': 'Loading stopped',
    'elapsed.completedAria': 'Calculator preparation completed',
    'elapsed.stoppedAria': 'Calculator preparation stopped',
    'elapsed.empty': 'Elapsed —',
    'guided.welcomeStep': 'Guided experiment · about one minute',
    'guided.welcomeTitle': 'Watch order become fluctuations',
    'guided.welcomeDetail': 'Start from an ordered SU(2) field, then watch Monte Carlo sampling build a fluctuating configuration.',
    'guided.start': 'Start guided experiment',
    'guided.priorKnowledge': 'No prior knowledge is needed. You can still use the Lab settings at any time.',
    'guided.predictStep': '01 · Predict',
    'guided.predictTitle': 'What will happen to an ordered field?',
    'guided.predictDetail': 'The bars show local plaquette action density, not objects standing in physical space.',
    'guided.exploreStep': '03 · Explore',
    'guided.exploreTitle': 'The sampled field now fluctuates across the lattice.',
    'guided.exploreDetail': 'Drag the sweep timeline to compare the cold start with later configurations. Sweeps are Monte Carlo sampling steps, not physical time.',
    'guided.observeStep': '02 · Observe',
    'guided.coldTitle': 'This is the ordered cold configuration.',
    'guided.coldDetail': 'Each bar is local plaquette action density on one two-dimensional slice. Watch how the pattern changes after sampling begins.',
    'guided.fluctuationTitle': 'Local fluctuations are appearing.',
    'guided.fluctuationDetail': 'The heatbath algorithm is moving away from the specially ordered start and sampling gauge-field configurations.',
    'guided.forgettingTitle': 'The initial order is being forgotten.',
    'guided.forgettingDetail': 'Compare the moving local pattern with the plaquette history. A sweep labels algorithmic progress, not physical time.',
    'observables.title': 'Observables',
    'observables.averagePlaquette': 'Average plaquette',
    'observables.normalizedPlaquette': 'Normalized Wilson plaquette',
    'observables.polyakov': 'Polyakov loop |L|',
    'observables.polyakovDetail': 'Magnitude of the spatial average',
    'observables.linksUpdated': 'Links updated',
    'observables.acceptanceRate': 'Acceptance rate',
    'observables.noHeatbath': 'No heatbath updates yet',
    'observables.noProposals': 'No link proposals yet',
    'observables.noHeatbathZero': 'No heatbath updates in a 0-sweep run',
    'observables.noProposalsZero': 'No link proposals in a 0-sweep run',
    'observables.heatbathDetail': 'Heatbath samples written without a Metropolis accept/reject step',
    'observables.acceptedDetail': '{accepted} of {offered} proposals accepted',
    'observables.history': 'Plaquette history',
    'observables.historyAria': 'Plaquette history by sweep',
    'observables.historyFallback': 'Plaquette history by sweep.',
    'observables.historyProgress': '{current} of {total} sweeps',
    'footer.local': 'Calculations run locally in your browser.',
    'footer.licenses': 'Third-party licenses',
  },
  ja: {
    'app.title': '格子ゲージ理論プレイグラウンド',
    'meta.description': '格子ゲージ理論をブラウザで体験できます。',
    'nav.skip': 'シミュレーション設定へ移動',
    'language.label': 'Language',
    'header.lab': 'ゲージ理論ラボ',
    'header.tagline': '格子ゲージ理論をブラウザで。',
    'header.builtWith': '',
    'header.componentsFrom': 'と、',
    'header.possessive': 'の',
    'settings.title': 'シミュレーション設定',
    'settings.gaugeGroup': 'ゲージ群',
    'settings.action': '作用',
    'settings.latticeSize': '格子サイズ',
    'settings.lattice1': '1⁴',
    'settings.lattice2': '2⁴',
    'settings.lattice4442': '4 × 4 × 4 × 2',
    'settings.lattice4': '4⁴',
    'settings.initialConfiguration': '初期配位',
    'settings.cold': 'コールド',
    'settings.random': 'ランダム',
    'settings.algorithm': 'アルゴリズム',
    'settings.heatbath': '熱浴法',
    'settings.metropolis': 'Metropolis法',
    'settings.heatbathUnavailable': '熱浴法は4方向すべて2以上の格子が必要です。この格子ではMetropolis法を選択します。',
    'settings.sweeps': 'スイープ数',
    'settings.seed': '乱数シード',
    'settings.sweepNote': '完了した各スイープごとに格子表示を更新します。',
    'settings.advanced': '詳細設定',
    'settings.proposalStrength': '提案強度 ε',
    'guidance.loading': '計算機の読み込み中も設定を変更できます。',
    'guidance.running': '計算中です。キャンセルしても完了済みスイープは保持され、続きから再開できます。',
    'guidance.cancelling': '次のJulia/WASMチャンク境界で停止します。保存済み状態は保持されます。',
    'guidance.savedView': '保存済み配位は保護されています。「選択面を表示」はスイープを増やさず新しい面を測定します。',
    'guidance.savedMatching': '保存済み配位は保護されています。「続ける」はスイープを追加し、「最初から」は配位を破棄します。',
    'guidance.savedMismatch': '物理設定が保存済み配位と異なります。設定を戻して続けるか、最初からやり直してください。',
    'summary.selectedLattice': '選択した格子',
    'summary.selectedAlgorithm': '選択したアルゴリズム',
    'summary.coldStart': 'コールドスタート',
    'summary.randomStart': 'ランダムスタート',
    'unit.sweepOne': '{count} スイープ',
    'unit.sweepOther': '{count} スイープ',
    'unit.selectedSweeps': '選択したスイープ数',
    'action.measureInitial': '初期状態を測定',
    'action.runCount': '{sweeps}を実行',
    'action.run': 'シミュレーション実行',
    'action.showPlane': '選択面を表示',
    'action.continue': '続ける',
    'action.continueCount': '続ける +{sweeps}',
    'action.startOver': '最初から',
    'action.startOverAria': '保存済みシミュレーションを破棄して最初からやり直す',
    'action.cancel': 'キャンセル',
    'action.retry': 'もう一度準備',
    'error.calculationTitle': '計算を完了できませんでした。',
    'error.calculationHint': '格子を小さくするか、スイープ数を減らしてください。',
    'error.invalidSettings': '強調表示されたシミュレーション設定を確認してください。',
    'error.runProtected': '新しく実行する前に「最初から」を選んでください。保存済み配位は保持されています。',
    'error.sameSettings': 'この操作には、完了時と同じ物理設定が必要です。',
    'visualization.title': 'ゲージ場の活動度',
    'visualization.subtitle': '1つのスライス上の局所プラケット作用密度',
    'visualization.view': '表示',
    'visualization.landscape': '立体表示',
    'visualization.heatmap': 'ヒートマップ',
    'visualization.plane': '平面',
    'visualization.slice': 'スライス',
    'visualization.evolution': '時間発展表示',
    'visualization.replay': '再生',
    'visualization.pause': '一時停止',
    'visualization.resume': '再開',
    'visualization.replayAria': '最初から時間発展を再生',
    'visualization.pauseAria': '時間発展の再生を一時停止',
    'visualization.resumeAria': '時間発展の再生を再開',
    'visualization.sliderAria': '受信済みのモンテカルロ・スイープを選択',
    'visualization.landscapeAria': 'ゲージ場活動度の立体表示',
    'visualization.heatmapAria': '局所プラケット作用密度ヒートマップ',
    'visualization.canvasFallback': 'ゲージ場活動度の可視化。',
    'visualization.readyExperiment': '実験を開始できます',
    'visualization.chooseExperiment': 'ガイド付き実験を選ぶか、左のラボ設定から独自の計算を設定してください。',
    'visualization.initialConfiguration': '初期配位',
    'visualization.sweepProgress': 'スイープ {current} / {total}',
    'visualization.landscapeSummary': '{frame} · 明るく高いほど揺らぎが強い · {plane}面 スライス{slice} · 値 {actualMin}〜{actualMax} · 固定範囲 {min}〜{max}',
    'visualization.heatmapSummary': '{frame} · {plane}面 · スライス{slice} · 値 {actualMin}〜{actualMax} · カラースケール {min}〜{max}',
    'visualization.loadingSummary': '計算機を読み込み中… 各棒は選択した格子スライス上の1サイトを表します。',
    'visualization.resultsAfterRun': '実行後、結果がここに表示されます。',
    'visualization.runToView': 'シミュレーションを実行すると格子を表示します。',
    'visualization.calculatorUnavailable': '計算機を利用できません',
    'visualization.unavailableSummary': 'ブラウザの接続を確認してから「もう一度準備」を選んでください。',
    'visualization.unavailableDetail': '接続を確認してから、もう一度準備してください。',
    'visualization.noHistoryZero': '0スイープ実行には履歴がありません。',
    'visualization.historyPlaceholder': 'プラケット履歴がここに表示されます。',
    'waiting.loadingTitle': '計算機を読み込み中…',
    'waiting.loadingDetail': '準備ができるまで設定を確認できます。',
    'waiting.loadingLongTitle': '計算機を引き続き読み込み中…',
    'waiting.loadingLongDetail': '初回は時間がかかることがあります。その間も設定を確認できます。',
    'waiting.firstChunkTitle': '最初のチャンクを計算中…',
    'waiting.firstChunkDetail': '最初の格子フレームを待っています。',
    'waiting.su3Title': 'SU(3)を準備中…',
    'waiting.su3Detail': '準備と計算に少し時間がかかる場合があります。',
    'waiting.startingTitle': 'シミュレーションを開始中…',
    'waiting.startingDetail': '最初の計算チャンクを待っています。',
    'waiting.continuation': '続きの計算を準備中…',
    'waiting.continuationDetail': '保存済み配位から計算を続けます…',
    'waiting.view': '選択面を更新中…',
    'waiting.viewDetail': '保存済み配位の選択面を測定中…',
    'status.loadingTitle': '計算機を読み込み中…',
    'status.loadingDetail': '準備中も設定を確認できます。初回は時間がかかる場合があります。',
    'status.loadingLongTitle': '引き続き読み込み中…',
    'status.loadingLongDetail': '初回は時間がかかる場合があります。次回以降はキャッシュにより速くなります。',
    'status.readyTitle': '準備完了',
    'status.readyDetail': '設定を選んで計算を実行してください。',
    'status.runningTitle': '計算中…',
    'status.runningDetail': '計算中もこのページを操作できます。',
    'status.initialMeasured': '初期配位を測定しました。',
    'status.errorTitle': '計算を完了できません',
    'status.errorDetail': '設定を調整して、もう一度お試しください。',
    'status.su3Title': 'SU(3)を準備中…',
    'status.su3Detail': '選択した計算エンジンを読み込んでいます。',
    'status.cancelledTitle': 'キャンセルしました',
    'status.completedTitle': '完了',
    'status.viewUpdatedTitle': '表示を更新しました',
    'status.cancelledOne': '完了済みの{count}スイープを保持しました。「続ける」を利用できます。',
    'status.cancelledOther': '完了済みの{count}スイープを保持しました。「続ける」を利用できます。',
    'status.viewMeasured': '{plane}面・スライス{slice}をスイープ{count}の配位で測定しました。',
    'status.measuredOne': '{count}スイープを測定しました。',
    'status.measuredOther': '{count}スイープを測定しました。',
    'status.continuingTitle': '計算を継続中…',
    'status.updatingViewTitle': '表示を更新中…',
    'status.startingTitle': '開始中…',
    'status.continuingDetail': '現在の配位に{count}スイープを追加します。',
    'status.viewKeptDetail': '保存済み配位とスイープ数は保持されます。',
    'status.startingDetail': '選択した小格子計算を準備しています。',
    'status.stoppingTitle': '停止中…',
    'status.stoppingDetail': '完了済み状態は「続ける」ために保持されます。',
    'elapsed.preparingAria': '計算機の準備時間',
    'elapsed.simulationAria': 'シミュレーション経過時間',
    'elapsed.loading': '読込 {seconds}秒',
    'elapsed.elapsed': '経過 {seconds}秒',
    'elapsed.ready': '{seconds}秒で準備完了',
    'elapsed.stopped': '読み込み停止',
    'elapsed.completedAria': '計算機の準備完了',
    'elapsed.stoppedAria': '計算機の準備停止',
    'elapsed.empty': '経過 —',
    'guided.welcomeStep': 'ガイド付き実験 · 約1分',
    'guided.welcomeTitle': '秩序が揺らぎへ変わる様子を見る',
    'guided.welcomeDetail': '整列したSU(2)ゲージ場から始め、モンテカルロ・サンプリングが揺らぐ配位を作る様子を観察します。',
    'guided.start': 'ガイド付き実験を開始',
    'guided.priorKnowledge': '予備知識は不要です。いつでも左のラボ設定を利用できます。',
    'guided.predictStep': '01 · 予想',
    'guided.predictTitle': '整列したゲージ場はどうなるでしょう？',
    'guided.predictDetail': '棒は物理空間に立つ物体ではなく、局所プラケット作用密度を表します。',
    'guided.exploreStep': '03 · 探索',
    'guided.exploreTitle': 'サンプリングされたゲージ場は格子上で揺らいでいます。',
    'guided.exploreDetail': 'スイープのスライダーを動かし、コールドスタートと後の配位を比較してください。スイープは物理時間ではなくモンテカルロのサンプリング段階です。',
    'guided.observeStep': '02 · 観察',
    'guided.coldTitle': 'これは整列したコールド初期配位です。',
    'guided.coldDetail': '各棒は2次元スライス上の局所プラケット作用密度です。サンプリング開始後の模様の変化を観察してください。',
    'guided.fluctuationTitle': '局所的な揺らぎが現れています。',
    'guided.fluctuationDetail': '熱浴法は特別に整列した初期状態から離れ、ゲージ場配位をサンプリングしています。',
    'guided.forgettingTitle': '初期の秩序が失われつつあります。',
    'guided.forgettingDetail': '動く局所パターンとプラケット履歴を比較してください。スイープはアルゴリズムの進行を示し、物理時間ではありません。',
    'observables.title': '物理量',
    'observables.averagePlaquette': '平均プラケット',
    'observables.normalizedPlaquette': '規格化Wilsonプラケット',
    'observables.polyakov': 'Polyakovループ |L|',
    'observables.polyakovDetail': '空間平均の絶対値',
    'observables.linksUpdated': '更新したリンク数',
    'observables.acceptanceRate': '受理率',
    'observables.noHeatbath': '熱浴更新はまだありません',
    'observables.noProposals': 'リンク提案はまだありません',
    'observables.noHeatbathZero': '0スイープ実行では熱浴更新はありません',
    'observables.noProposalsZero': '0スイープ実行ではリンク提案はありません',
    'observables.heatbathDetail': 'Metropolisの受理・棄却なしで書き込まれた熱浴サンプル数',
    'observables.acceptedDetail': '{offered}提案中{accepted}件を受理',
    'observables.history': 'プラケット履歴',
    'observables.historyAria': 'スイープごとのプラケット履歴',
    'observables.historyFallback': 'スイープごとのプラケット履歴。',
    'observables.historyProgress': '{total}スイープ中{current}',
    'footer.local': '計算はブラウザ内でローカルに実行されます。',
    'footer.licenses': 'サードパーティ・ライセンス',
  },
  'zh-Hans': {
    'app.title': '格点规范场论实验平台',
    'meta.description': '在浏览器中探索小格点规范场论。',
    'nav.skip': '跳转到模拟设置',
    'language.label': 'Language',
    'header.lab': '规范场论实验室',
    'header.tagline': '在浏览器中探索小格点规范场论。',
    'header.builtWith': '使用',
    'header.componentsFrom': '，以及改编自',
    'header.possessive': '的',
    'settings.title': '模拟设置',
    'settings.gaugeGroup': '规范群',
    'settings.action': '作用量',
    'settings.latticeSize': '格点大小',
    'settings.lattice1': '1⁴',
    'settings.lattice2': '2⁴',
    'settings.lattice4442': '4 × 4 × 4 × 2',
    'settings.lattice4': '4⁴',
    'settings.initialConfiguration': '初始位形',
    'settings.cold': '冷启动',
    'settings.random': '随机',
    'settings.algorithm': '算法',
    'settings.heatbath': '热浴法',
    'settings.metropolis': 'Metropolis算法',
    'settings.heatbathUnavailable': '热浴法要求四个方向的格点长度都至少为2。此格点将使用Metropolis算法。',
    'settings.sweeps': '扫掠次数',
    'settings.seed': '随机种子',
    'settings.sweepNote': '每次完成扫掠后都会更新格点视图。',
    'settings.advanced': '高级设置',
    'settings.proposalStrength': '提议强度 ε',
    'guidance.loading': '计算器加载时也可以修改设置。',
    'guidance.running': '计算正在运行。取消后已完成的扫掠仍会保留，可继续计算。',
    'guidance.cancelling': '将在下一个Julia/WASM分块边界停止，并保留已保存状态。',
    'guidance.savedView': '已保存位形受到保护。“显示所选平面”会测量新视图而不增加扫掠。',
    'guidance.savedMatching': '已保存位形受到保护。“继续”会增加扫掠，“重新开始”会丢弃它。',
    'guidance.savedMismatch': '物理设置与已保存位形不同。请恢复设置后继续，或重新开始。',
    'summary.selectedLattice': '所选格点',
    'summary.selectedAlgorithm': '所选算法',
    'summary.coldStart': '冷启动',
    'summary.randomStart': '随机启动',
    'unit.sweepOne': '{count} 次扫掠',
    'unit.sweepOther': '{count} 次扫掠',
    'unit.selectedSweeps': '所选扫掠次数',
    'action.measureInitial': '测量初始状态',
    'action.runCount': '运行 {sweeps}',
    'action.run': '运行模拟',
    'action.showPlane': '显示所选平面',
    'action.continue': '继续',
    'action.continueCount': '继续 +{sweeps}',
    'action.startOver': '重新开始',
    'action.startOverAria': '丢弃已保存模拟并重新开始',
    'action.cancel': '取消',
    'action.retry': '重新准备',
    'error.calculationTitle': '计算未能完成。',
    'error.calculationHint': '请减小格点或减少扫掠次数。',
    'error.invalidSettings': '请检查高亮显示的模拟设置。',
    'error.runProtected': '运行新模拟前请先选择“重新开始”。已保存位形仍被保留。',
    'error.sameSettings': '此操作需要与已完成计算相同的物理设置。',
    'visualization.title': '规范场活动度',
    'visualization.subtitle': '一个切片上的局域小方格作用量密度',
    'visualization.view': '视图',
    'visualization.landscape': '立体图',
    'visualization.heatmap': '热图',
    'visualization.plane': '平面',
    'visualization.slice': '切片',
    'visualization.evolution': '演化',
    'visualization.replay': '重播',
    'visualization.pause': '暂停',
    'visualization.resume': '继续播放',
    'visualization.replayAria': '从头重播演化过程',
    'visualization.pauseAria': '暂停演化重播',
    'visualization.resumeAria': '继续演化重播',
    'visualization.sliderAria': '选择已接收的蒙特卡罗扫掠',
    'visualization.landscapeAria': '规范场活动度立体图',
    'visualization.heatmapAria': '局域小方格作用量密度热图',
    'visualization.canvasFallback': '规范场活动度可视化。',
    'visualization.readyExperiment': '可以开始实验',
    'visualization.chooseExperiment': '选择引导实验，或使用左侧实验室设置自行配置。',
    'visualization.initialConfiguration': '初始位形',
    'visualization.sweepProgress': '扫掠 {current} / {total}',
    'visualization.landscapeSummary': '{frame} · 越亮越高表示涨落越强 · {plane}平面 切片{slice} · 数值 {actualMin}至{actualMax} · 固定范围 {min}至{max}',
    'visualization.heatmapSummary': '{frame} · {plane}平面 · 切片{slice} · 数值 {actualMin}至{actualMax} · 色标 {min}至{max}',
    'visualization.loadingSummary': '正在加载计算器… 每根柱表示所选格点切片上的一个格点。',
    'visualization.resultsAfterRun': '运行后结果将显示在这里。',
    'visualization.runToView': '运行模拟后即可查看格点。',
    'visualization.calculatorUnavailable': '计算器不可用',
    'visualization.unavailableSummary': '请检查浏览器连接，然后选择“重新准备”。',
    'visualization.unavailableDetail': '检查连接后，请重新准备。',
    'visualization.noHistoryZero': '0次扫掠的运行没有历史记录。',
    'visualization.historyPlaceholder': '小方格历史将显示在这里。',
    'waiting.loadingTitle': '正在加载计算器…',
    'waiting.loadingDetail': '准备期间可以查看设置。',
    'waiting.loadingLongTitle': '计算器仍在加载…',
    'waiting.loadingLongDetail': '首次访问可能较慢，期间仍可查看设置。',
    'waiting.firstChunkTitle': '正在计算第一个分块…',
    'waiting.firstChunkDetail': '正在等待第一帧格点数据。',
    'waiting.su3Title': '正在准备SU(3)…',
    'waiting.su3Detail': '准备和计算可能需要更长时间。',
    'waiting.startingTitle': '正在启动模拟…',
    'waiting.startingDetail': '正在等待第一个计算分块。',
    'waiting.continuation': '正在准备继续计算…',
    'waiting.continuationDetail': '将从已保存位形继续计算…',
    'waiting.view': '正在更新所选平面…',
    'waiting.viewDetail': '正在测量已保存位形的所选平面…',
    'status.loadingTitle': '正在加载计算器…',
    'status.loadingDetail': '准备期间可以查看设置。首次访问可能较慢。',
    'status.loadingLongTitle': '仍在加载…',
    'status.loadingLongDetail': '首次访问可能较慢。缓存文件会加快后续访问。',
    'status.readyTitle': '准备就绪',
    'status.readyDetail': '选择设置并运行计算。',
    'status.runningTitle': '正在计算…',
    'status.runningDetail': '计算期间仍可操作此页面。',
    'status.initialMeasured': '已测量初始位形。',
    'status.errorTitle': '无法完成计算',
    'status.errorDetail': '请调整设置后重试。',
    'status.su3Title': '正在准备SU(3)…',
    'status.su3Detail': '正在加载所选计算引擎。',
    'status.cancelledTitle': '已取消',
    'status.completedTitle': '已完成',
    'status.viewUpdatedTitle': '视图已更新',
    'status.cancelledOne': '已保留{count}次完成的扫掠，可以继续计算。',
    'status.cancelledOther': '已保留{count}次完成的扫掠，可以继续计算。',
    'status.viewMeasured': '已在扫掠{count}的位形上测量{plane}平面、切片{slice}。',
    'status.measuredOne': '已测量{count}次扫掠。',
    'status.measuredOther': '已测量{count}次扫掠。',
    'status.continuingTitle': '正在继续…',
    'status.updatingViewTitle': '正在更新视图…',
    'status.startingTitle': '正在启动…',
    'status.continuingDetail': '在当前位形上增加{count}次扫掠。',
    'status.viewKeptDetail': '已保存位形和扫掠次数将保持不变。',
    'status.startingDetail': '正在准备所选小格点计算。',
    'status.stoppingTitle': '正在停止…',
    'status.stoppingDetail': '已完成状态将保留以便继续计算。',
    'elapsed.preparingAria': '计算器准备时间',
    'elapsed.simulationAria': '模拟经过时间',
    'elapsed.loading': '加载 {seconds} 秒',
    'elapsed.elapsed': '经过 {seconds} 秒',
    'elapsed.ready': '{seconds} 秒后准备就绪',
    'elapsed.stopped': '加载已停止',
    'elapsed.completedAria': '计算器准备完成',
    'elapsed.stoppedAria': '计算器准备已停止',
    'elapsed.empty': '经过 —',
    'guided.welcomeStep': '引导实验 · 约一分钟',
    'guided.welcomeTitle': '观察有序状态变成涨落',
    'guided.welcomeDetail': '从有序SU(2)规范场开始，观察蒙特卡罗采样如何形成具有涨落的位形。',
    'guided.start': '开始引导实验',
    'guided.priorKnowledge': '无需预备知识。也可以随时使用左侧实验室设置。',
    'guided.predictStep': '01 · 预测',
    'guided.predictTitle': '有序规范场将发生什么？',
    'guided.predictDetail': '柱体表示局域小方格作用量密度，而不是物理空间中竖立的物体。',
    'guided.exploreStep': '03 · 探索',
    'guided.exploreTitle': '采样后的规范场正在格点上发生涨落。',
    'guided.exploreDetail': '拖动扫掠时间轴，比较冷启动与后续位形。扫掠是蒙特卡罗采样步骤，并非物理时间。',
    'guided.observeStep': '02 · 观察',
    'guided.coldTitle': '这是有序的冷启动初始位形。',
    'guided.coldDetail': '每根柱表示一个二维切片上的局域小方格作用量密度。观察采样开始后图案如何变化。',
    'guided.fluctuationTitle': '局域涨落正在出现。',
    'guided.fluctuationDetail': '热浴算法正在离开特殊的有序初态，并对规范场位形进行采样。',
    'guided.forgettingTitle': '初始有序性正在消失。',
    'guided.forgettingDetail': '比较变化的局域图案和小方格历史。扫掠表示算法进度，并非物理时间。',
    'observables.title': '可观测量',
    'observables.averagePlaquette': '平均小方格',
    'observables.normalizedPlaquette': '归一化Wilson小方格',
    'observables.polyakov': 'Polyakov环 |L|',
    'observables.polyakovDetail': '空间平均的模',
    'observables.linksUpdated': '已更新链变量',
    'observables.acceptanceRate': '接受率',
    'observables.noHeatbath': '尚无热浴更新',
    'observables.noProposals': '尚无链变量提议',
    'observables.noHeatbathZero': '0次扫掠的运行没有热浴更新',
    'observables.noProposalsZero': '0次扫掠的运行没有链变量提议',
    'observables.heatbathDetail': '无需Metropolis接受/拒绝步骤写入的热浴样本数',
    'observables.acceptedDetail': '{offered}次提议中接受了{accepted}次',
    'observables.history': '小方格历史',
    'observables.historyAria': '每次扫掠的小方格历史',
    'observables.historyFallback': '每次扫掠的小方格历史。',
    'observables.historyProgress': '{total}次扫掠中的第{current}次',
    'footer.local': '计算完全在浏览器本地运行。',
    'footer.licenses': '第三方许可证',
  },
};

let currentLanguage = 'en';

function recognizedLanguage(language) {
  const candidate = String(language ?? '').toLowerCase();
  if (candidate === 'en' || candidate === 'english' || candidate.startsWith('en-')) return 'en';
  if (
    candidate === 'ja'
    || candidate === 'jp'
    || candidate === 'japanese'
    || candidate === '日本語'
    || candidate.startsWith('ja-')
  ) return 'ja';
  if (
    candidate === 'zh'
    || candidate === 'zh-hans'
    || candidate === 'zh-cn'
    || candidate === 'zh-sg'
    || candidate === 'chinese'
    || candidate === 'simplified-chinese'
    || candidate === '简体中文'
    || candidate.startsWith('zh-')
  ) return 'zh-Hans';
  return null;
}

function normalizeLanguage(language) {
  return recognizedLanguage(language) ?? 'en';
}

export function languageFromSearch(search = '') {
  const parameters = new URLSearchParams(String(search ?? '').replace(/^\?/, ''));
  for (const name of ['lang', 'language']) {
    if (!parameters.has(name)) continue;
    return recognizedLanguage(parameters.get(name));
  }
  return null;
}

export function preferredLanguage(storedLanguage, browserLanguages = [], urlLanguage = null) {
  const recognizedUrlLanguage = recognizedLanguage(urlLanguage);
  if (recognizedUrlLanguage !== null) return recognizedUrlLanguage;
  if (SUPPORTED_LANGUAGES.includes(storedLanguage)) return storedLanguage;
  for (const language of browserLanguages) {
    const normalized = normalizeLanguage(language);
    if (normalized !== 'en' || String(language).toLowerCase().startsWith('en')) {
      return normalized;
    }
  }
  return 'en';
}

export function getLanguage() {
  return currentLanguage;
}

export function updateLanguageInUrl(
  language,
  {
    location = globalThis.location,
    history = globalThis.history,
  } = {},
) {
  if (location?.href === undefined || typeof history?.replaceState !== 'function') return false;
  try {
    const url = new URL(location.href);
    url.searchParams.set('lang', normalizeLanguage(language));
    url.searchParams.delete('language');
    history.replaceState(history.state ?? null, '', `${url.pathname}${url.search}${url.hash}`);
    return true;
  } catch {
    return false;
  }
}

export function t(key, variables = {}, language = currentLanguage) {
  const dictionary = translations[language] ?? translations.en;
  const template = dictionary[key] ?? translations.en[key];
  if (template === undefined) return key;
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_, name) => (
    Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : `{${name}}`
  ));
}

export function translationKeys(language = currentLanguage) {
  return Object.keys(translations[language] ?? {}).sort();
}

export function translateDocument(root = globalThis.document) {
  if (root === undefined) return;
  const documentElement = root.documentElement ?? root.ownerDocument?.documentElement;
  if (documentElement !== undefined) documentElement.lang = currentLanguage;
  const query = selector => Array.from(root.querySelectorAll?.(selector) ?? []);
  query('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
  query('[data-i18n-aria-label]').forEach(element => {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
  });
  query('[data-i18n-content]').forEach(element => {
    element.setAttribute('content', t(element.dataset.i18nContent));
  });
  if (root.title !== undefined) root.title = t('app.title');
}

export function setLanguage(language, { persist = true, root = globalThis.document } = {}) {
  currentLanguage = normalizeLanguage(language);
  if (persist) {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, currentLanguage);
    } catch {
      // The interface still switches when storage is unavailable or blocked.
    }
  }
  translateDocument(root);
  return currentLanguage;
}

export function initializeI18n(root = globalThis.document) {
  let storedLanguage = null;
  try {
    storedLanguage = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    // Use the browser preference when storage is unavailable or blocked.
  }
  const browserLanguages = globalThis.navigator?.languages
    ?? (globalThis.navigator?.language ? [globalThis.navigator.language] : []);
  const urlLanguage = languageFromSearch(globalThis.location?.search ?? '');
  return setLanguage(
    preferredLanguage(storedLanguage, browserLanguages, urlLanguage),
    { persist: false, root },
  );
}
