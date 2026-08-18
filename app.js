import {
  DEFAULT_BETA_BY_GAUGE_GROUP,
  heatbathSupportsLattice,
  heatmapColorRange,
  landscapePlaneBasis,
  WebContractError,
  decodeWebResult,
  planeSliceMaximum,
  validateSimulationParameters,
} from './result-contract.mjs?v=runtime-v21';
import {
  GUIDED_EXPERIMENT,
  guidedNarration,
} from './outreach-guide.mjs?v=outreach-guide-1';
import {
  getLanguage,
  initializeI18n,
  setLanguage,
  t,
  updateLanguageInUrl,
} from './i18n.mjs?v=i18n-7';

initializeI18n();

const form = document.querySelector('#simulation-form');
const languageSelector = document.querySelector('#language-selector');
const gaugeGroupInput = document.querySelector('#gauge-group');
const gaugeTag = document.querySelector('#gauge-tag');
const latticeInput = document.querySelector('#lattice-size');
const betaInput = document.querySelector('#beta');
const conditionInput = document.querySelector('#condition');
const algorithmInput = document.querySelector('#algorithm');
const heatbathOption = algorithmInput.querySelector('option[value="heatbath"]');
const algorithmCompatibility = document.querySelector('#algorithm-compatibility');
const visualizationModeInput = document.querySelector('#visualization-mode');
const sweepsInput = document.querySelector('#sweeps');
const seedInput = document.querySelector('#seed');
const epsilonInput = document.querySelector('#epsilon');
const epsilonField = document.querySelector('#epsilon-field');
const planeInput = document.querySelector('#plane');
const sliceInput = document.querySelector('#slice');
const replayButton = document.querySelector('#replay-button');
const replaySlider = document.querySelector('#replay-slider');
const frameIndicator = document.querySelector('#frame-indicator');
const runButton = document.querySelector('#run-button');
const viewPlaneButton = document.querySelector('#view-plane-button');
const continueButton = document.querySelector('#continue-button');
const resetButton = document.querySelector('#reset-button');
const cancelButton = document.querySelector('#cancel-button');
const actionGuidance = document.querySelector('#action-guidance');
const retryButton = document.querySelector('#retry-button');
const statusText = document.querySelector('#status-text');
const statusDetail = document.querySelector('#status-detail');
const elapsedTime = document.querySelector('#elapsed-time');
const formError = document.querySelector('#form-error');
const calculationError = document.querySelector('#calculation-error');
const plaquetteValue = document.querySelector('#plaquette-value');
const polyakovValue = document.querySelector('#polyakov-value');
const acceptanceValue = document.querySelector('#acceptance-value');
const updateRateLabel = document.querySelector('#update-rate-label');
const acceptanceDetail = document.querySelector('#acceptance-detail');
const historyCount = document.querySelector('#history-count');
const heatmapSummary = document.querySelector('#heatmap-summary');
const activityFrame = document.querySelector('#activity-frame');
const activityWaiting = document.querySelector('#activity-waiting');
const activityWaitingTitle = document.querySelector('#activity-waiting-title');
const activityWaitingDetail = document.querySelector('#activity-waiting-detail');
const guidedWelcome = document.querySelector('#guided-welcome');
const guidedStartButton = document.querySelector('#guided-start-button');
const guidedCallout = document.querySelector('#guided-callout');
const guidedStep = document.querySelector('#guided-step');
const guidedTitle = document.querySelector('#guided-title');
const guidedDetail = document.querySelector('#guided-detail');
const heatmapCanvas = document.querySelector('#heatmap');
const historyCanvas = document.querySelector('#history-chart');

let simulationWorker = null;
let workerGeneration = 0;
let runtimeReady = false;
let running = false;
let cancelling = false;
let jobSequence = 0;
let activeJob = null;
let elapsedTimer = null;
let elapsedStartedAt = null;
let preparationTimer = null;
let preparationSlowTimer = null;
let preparationStartedAt = null;
let latestResult = null;
let latestParameters = null;
let playbackTimer = null;
let playbackFrameIndex = 0;
let playbackPaused = false;
let liveFrameTimer = null;
let liveFrameQueue = [];
let pendingResultMessage = null;
let continuationSignature = null;
let selectedGaugeGroup = gaugeGroupInput.value;
let guidedSessionActive = false;
let guidedProgress = null;
let currentStatus = {
  state: 'booting',
  titleKey: 'status.loadingTitle',
  detailKey: 'status.loadingDetail',
  variables: {},
};
let currentWaiting = {
  titleKey: 'waiting.loadingTitle',
  detailKey: 'waiting.loadingDetail',
  variables: {},
};
let currentElapsed = {
  key: 'elapsed.loading',
  variables: { seconds: '0.0' },
  ariaKey: 'elapsed.preparingAria',
};
let currentMetricCopy = {
  labelKey: 'observables.linksUpdated',
  detailKey: 'observables.noHeatbath',
  variables: {},
};
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const betaByGaugeGroup = new Map(
  Object.entries(DEFAULT_BETA_BY_GAUGE_GROUP).map(([group, beta]) => [group, String(beta)]),
);

function setStatus(state, titleKey, detailKey, variables = {}) {
  currentStatus = { state, titleKey, detailKey, variables };
  document.body.dataset.state = state;
  statusText.textContent = t(titleKey, variables);
  statusDetail.textContent = t(detailKey, variables);
}

function setElapsedDisplay(key, variables = {}, ariaKey = currentElapsed.ariaKey) {
  currentElapsed = { key, variables, ariaKey };
  elapsedTime.textContent = t(key, variables);
  if (ariaKey !== null) elapsedTime.setAttribute('aria-label', t(ariaKey));
}

function setMetricCopy(labelKey, detailKey, variables = {}) {
  currentMetricCopy = { labelKey, detailKey, variables };
  updateRateLabel.textContent = t(labelKey, variables);
  acceptanceDetail.textContent = t(detailKey, variables);
}

function showHeatmapWaitingState(titleKey, detailKey, variables = {}) {
  currentWaiting = { titleKey, detailKey, variables };
  guidedWelcome.hidden = true;
  const title = t(titleKey, variables);
  const detail = t(detailKey, variables);
  frameIndicator.textContent = title;
  heatmapSummary.textContent = `${title} ${detail}`;
  activityFrame.setAttribute('aria-busy', 'true');
  activityWaitingTitle.textContent = title;
  activityWaitingDetail.textContent = detail;
  activityWaiting.hidden = false;
  drawCanvasMessage(heatmapCanvas, '', true);
}

function hideHeatmapWaitingState() {
  activityFrame.setAttribute('aria-busy', 'false');
  activityWaiting.hidden = true;
  currentWaiting = null;
}

function hideGuidedExperience() {
  guidedWelcome.hidden = true;
  guidedCallout.hidden = true;
}

function showGuidedWelcome() {
  if (!runtimeReady || running || latestResult !== null) return;
  hideHeatmapWaitingState();
  guidedCallout.hidden = true;
  guidedWelcome.hidden = false;
  guidedStartButton.disabled = false;
  frameIndicator.textContent = t('visualization.readyExperiment');
  heatmapSummary.textContent = t('visualization.chooseExperiment');
  drawCanvasMessage(heatmapCanvas, '', true);
}

function updateGuidedNarration(progress) {
  if (!guidedSessionActive) return;
  guidedProgress = progress;
  const narration = guidedNarration(progress);
  guidedStep.textContent = t(narration.stepKey);
  guidedTitle.textContent = t(narration.titleKey);
  guidedDetail.textContent = t(narration.detailKey);
  guidedCallout.hidden = false;
}

function startGuidedExperiment() {
  if (!runtimeReady || running || latestResult !== null) return;
  guidedSessionActive = true;
  gaugeGroupInput.value = GUIDED_EXPERIMENT.gaugeGroup;
  latticeInput.value = GUIDED_EXPERIMENT.latticeExtents;
  betaInput.value = GUIDED_EXPERIMENT.beta;
  conditionInput.value = GUIDED_EXPERIMENT.condition;
  algorithmInput.value = GUIDED_EXPERIMENT.algorithm;
  sweepsInput.value = GUIDED_EXPERIMENT.sweeps;
  seedInput.value = GUIDED_EXPERIMENT.seed;
  visualizationModeInput.value = GUIDED_EXPERIMENT.visualization;
  planeInput.value = GUIDED_EXPERIMENT.plane;
  sliceInput.value = GUIDED_EXPERIMENT.slice;
  selectedGaugeGroup = GUIDED_EXPERIMENT.gaugeGroup;
  updateGaugeGroup();
  updateSliceBounds();
  updateAlgorithmAvailability();
  updateVisualizationMode();
  updateButtons();
  guidedWelcome.hidden = true;
  updateGuidedNarration({ sweep: 0, totalSweeps: Number(GUIDED_EXPERIMENT.sweeps) });
  startSimulation(null, 'run');
}

function selectedRunSummary(sweepLabel) {
  const gaugeGroup = gaugeGroupInput.value === 'SU2' ? 'SU(2)' : 'SU(3)';
  const lattice = latticeInput.selectedOptions[0]?.textContent?.split(' · ')[0] ?? t('summary.selectedLattice');
  const algorithm = algorithmInput.selectedOptions[0]?.textContent ?? t('summary.selectedAlgorithm');
  const condition = conditionInput.value === 'cold' ? t('summary.coldStart') : t('summary.randomStart');
  return `${gaugeGroup} · ${lattice} · ${algorithm} · ${sweepLabel} · ${condition}`;
}

function sweepCountText(count) {
  return t(count === 1 ? 'unit.sweepOne' : 'unit.sweepOther', { count });
}

function updateButtons() {
  const hasSavedResult = latestResult !== null;
  const matchingContinuation = continuationSignature !== null
    && continuationSignature === currentInputSignature();
  const viewChanged = hasSavedResult
    && latestParameters !== null
    && parametersViewSignature(latestParameters) !== currentInputViewSignature();
  const sweepCount = Number(sweepsInput.value);
  const sweepLabel = Number.isInteger(sweepCount) && sweepCount >= 0
    ? sweepCountText(sweepCount)
    : t('unit.selectedSweeps');

  runButton.textContent = Number.isInteger(sweepCount) && sweepCount >= 0
    ? (sweepCount === 0 ? t('action.measureInitial') : t('action.runCount', { sweeps: sweepLabel }))
    : t('action.run');

  runButton.hidden = running || hasSavedResult;
  viewPlaneButton.hidden = running
    || !hasSavedResult
    || !matchingContinuation
    || !viewChanged;
  continueButton.hidden = running || !hasSavedResult;
  resetButton.hidden = running || !hasSavedResult;
  cancelButton.hidden = !running;

  runButton.disabled = !runtimeReady || running || hasSavedResult;
  viewPlaneButton.disabled = !runtimeReady
    || running
    || !hasSavedResult
    || !matchingContinuation
    || !viewChanged;
  continueButton.disabled = !runtimeReady
    || running
    || !hasSavedResult
    || !matchingContinuation;
  continueButton.textContent = t('action.continueCount', { sweeps: sweepLabel });
  resetButton.disabled = running || !hasSavedResult;
  cancelButton.disabled = !running || cancelling;

  if (running) {
    actionGuidance.textContent = cancelling
      ? t('guidance.cancelling')
      : t('guidance.running');
  } else if (hasSavedResult) {
    if (matchingContinuation && viewChanged) {
      actionGuidance.textContent = t('guidance.savedView');
    } else {
      actionGuidance.textContent = matchingContinuation
        ? t('guidance.savedMatching')
        : t('guidance.savedMismatch');
    }
  } else if (!runtimeReady) {
    actionGuidance.textContent = t('guidance.loading');
  } else {
    actionGuidance.textContent = selectedRunSummary(sweepLabel);
  }
}

function clearPublicError() {
  calculationError.hidden = true;
}

function showPublicError(detail, stage = 'unknown') {
  finishPreparationTimer(false);
  runtimeReady = simulationWorker !== null && stage !== 'worker';
  running = false;
  cancelling = false;
  continuationSignature = null;
  clearLiveFramePipeline();
  stopElapsedTimer();
  updateButtons();
  calculationError.hidden = false;
  setStatus('error', 'status.errorTitle', 'status.errorDetail');
  if (latestResult === null) {
    hideGuidedExperience();
    hideHeatmapWaitingState();
    frameIndicator.textContent = t('visualization.calculatorUnavailable');
    heatmapSummary.textContent = t('visualization.unavailableSummary');
    drawCanvasMessage(
      heatmapCanvas,
      t('visualization.calculatorUnavailable'),
      true,
      t('visualization.unavailableDetail'),
    );
  }
  console.error(`GaugefieldsLite calculation error [${stage}]: ${detail}`);
}

function rawParameters() {
  return {
    gaugeGroup: gaugeGroupInput.value,
    latticeExtents: latticeInput.value.split(',').map(Number),
    beta: Number(betaInput.value),
    condition: conditionInput.value,
    algorithm: algorithmInput.value,
    sweeps: Number(sweepsInput.value),
    seed: Number(seedInput.value),
    epsilon: Number(epsilonInput.value),
    plane: planeInput.value,
    slice: Number(sliceInput.value),
  };
}

function readParameters() {
  if (!form.reportValidity()) {
    throw new WebContractError(t('error.invalidSettings'));
  }
  return validateSimulationParameters(rawParameters());
}

function parametersSignature(parameters) {
  return JSON.stringify({
    gaugeGroup: parameters.gaugeGroup,
    latticeExtents: Array.from(parameters.latticeExtents),
    beta: parameters.beta,
    condition: parameters.condition,
    algorithm: parameters.algorithm,
    seed: parameters.seed,
    epsilon: parameters.epsilon,
  });
}

function parametersViewSignature(parameters) {
  return JSON.stringify({
    plane: parameters.plane,
    slice: parameters.slice,
  });
}

function currentInputSignature() {
  try {
    return parametersSignature(validateSimulationParameters(rawParameters()));
  } catch {
    return null;
  }
}

function currentInputViewSignature() {
  try {
    return parametersViewSignature(validateSimulationParameters(rawParameters()));
  } catch {
    return null;
  }
}

function updateSliceBounds() {
  const latticeExtents = latticeInput.value.split(',').map(Number);
  const maximum = planeSliceMaximum(latticeExtents, planeInput.value);
  sliceInput.max = String(maximum);
  if (Number(sliceInput.value) > maximum) sliceInput.value = String(maximum);
}

function updateAlgorithmAvailability() {
  const latticeExtents = latticeInput.value.split(',').map(Number);
  const heatbathAvailable = heatbathSupportsLattice(latticeExtents);
  heatbathOption.disabled = !heatbathAvailable;
  algorithmCompatibility.hidden = heatbathAvailable;
  algorithmCompatibility.textContent = heatbathAvailable
    ? ''
    : t('settings.heatbathUnavailable');
  if (!heatbathAvailable && algorithmInput.value === 'heatbath') {
    algorithmInput.value = 'metropolis';
    formError.hidden = true;
  }
  updateAlgorithm();
}

function updateVisualizationMode({ redraw = true } = {}) {
  const isLandscape = visualizationModeInput.value === 'landscape';
  activityFrame.dataset.view = isLandscape ? 'landscape' : 'heatmap';
  heatmapCanvas.setAttribute(
    'aria-label',
    isLandscape
      ? t('visualization.landscapeAria')
      : t('visualization.heatmapAria'),
  );
  if (redraw) redrawLatestResult();
}

function updateGaugeGroup({ restoreBeta = false } = {}) {
  const nextGaugeGroup = gaugeGroupInput.value;
  if (restoreBeta && nextGaugeGroup !== selectedGaugeGroup) {
    betaByGaugeGroup.set(selectedGaugeGroup, betaInput.value);
    betaInput.value = betaByGaugeGroup.get(nextGaugeGroup)
      ?? String(DEFAULT_BETA_BY_GAUGE_GROUP[nextGaugeGroup]);
    selectedGaugeGroup = nextGaugeGroup;
  }
  const isSu2 = gaugeGroupInput.value === 'SU2';
  gaugeTag.textContent = isSu2 ? 'SU(2)' : 'SU(3)';
}

function updateAlgorithm() {
  const isHeatbath = algorithmInput.value === 'heatbath';
  epsilonInput.disabled = isHeatbath;
  epsilonField.hidden = isHeatbath;
  if (latestResult === null) {
    acceptanceValue.textContent = '—';
    setMetricCopy(
      isHeatbath ? 'observables.linksUpdated' : 'observables.acceptanceRate',
      isHeatbath ? 'observables.noHeatbath' : 'observables.noProposals',
    );
  } else {
    updateRateLabel.textContent = t(currentMetricCopy.labelKey, currentMetricCopy.variables);
  }
}

function startElapsedTimer() {
  stopElapsedTimer();
  elapsedStartedAt = performance.now();
  const update = () => {
    setElapsedDisplay('elapsed.elapsed', {
      seconds: ((performance.now() - elapsedStartedAt) / 1000).toFixed(1),
    }, 'elapsed.simulationAria');
  };
  update();
  elapsedTimer = window.setInterval(update, 200);
}

function stopElapsedTimer() {
  if (elapsedTimer !== null) window.clearInterval(elapsedTimer);
  elapsedTimer = null;
}

function clearPreparationTimer() {
  if (preparationTimer !== null) window.clearInterval(preparationTimer);
  if (preparationSlowTimer !== null) window.clearTimeout(preparationSlowTimer);
  preparationTimer = null;
  preparationSlowTimer = null;
}

function startPreparationTimer() {
  clearPreparationTimer();
  preparationStartedAt = performance.now();
  const update = () => {
    setElapsedDisplay('elapsed.loading', {
      seconds: ((performance.now() - preparationStartedAt) / 1000).toFixed(1),
    }, 'elapsed.preparingAria');
  };
  update();
  preparationTimer = window.setInterval(update, 200);
  preparationSlowTimer = window.setTimeout(() => {
    if (runtimeReady || preparationStartedAt === null) return;
    setStatus(
      'preparing',
      'status.loadingLongTitle',
      'status.loadingLongDetail',
    );
    if (latestResult === null) {
      showHeatmapWaitingState(
        'waiting.loadingLongTitle',
        'waiting.loadingLongDetail',
      );
    }
  }, 8000);
}

function finishPreparationTimer(succeeded) {
  if (preparationStartedAt === null) return;
  const elapsedSeconds = (performance.now() - preparationStartedAt) / 1000;
  clearPreparationTimer();
  preparationStartedAt = null;
  setElapsedDisplay(
    succeeded ? 'elapsed.ready' : 'elapsed.stopped',
    succeeded ? { seconds: elapsedSeconds.toFixed(1) } : {},
    succeeded ? 'elapsed.completedAria' : 'elapsed.stoppedAria',
  );
}

function updateReplayControl(result = latestResult) {
  const playable = result !== null && result.frameCount > 1 && !running;
  replayButton.disabled = !playable;
  replaySlider.disabled = !playable;
  replaySlider.max = String(Math.max(0, (result?.frameCount ?? 1) - 1));
  replaySlider.value = String(Math.max(0, Math.min(
    playbackFrameIndex,
    Number(replaySlider.max),
  )));
  if (playbackTimer !== null) {
    replayButton.textContent = t('visualization.pause');
    replayButton.setAttribute('aria-label', t('visualization.pauseAria'));
  } else if (playbackPaused) {
    replayButton.textContent = t('visualization.resume');
    replayButton.setAttribute('aria-label', t('visualization.resumeAria'));
  } else {
    replayButton.textContent = t('visualization.replay');
    replayButton.setAttribute('aria-label', t('visualization.replayAria'));
  }
}

function stopHeatmapPlayback({ paused = false } = {}) {
  if (playbackTimer !== null) window.clearInterval(playbackTimer);
  playbackTimer = null;
  playbackPaused = paused;
  updateReplayControl();
}

function clearLiveFramePipeline() {
  if (liveFrameTimer !== null) window.clearTimeout(liveFrameTimer);
  liveFrameTimer = null;
  liveFrameQueue = [];
  pendingResultMessage = null;
}

function renderProgressMessage(message) {
  renderLiveFrame(message.frame, activeJob.parameters);
  updateGuidedNarration({
    sweep: message.frame.sweep,
    totalSweeps: message.frame.totalSweeps,
  });
  setStatus(
    'running',
    'status.runningTitle',
    message.frame.sweep === 0
      ? 'status.initialMeasured'
      : 'visualization.sweepProgress',
    { current: message.frame.sweep, total: message.frame.totalSweeps },
  );
}

function finishPendingResultIfDrained() {
  if (liveFrameTimer !== null || liveFrameQueue.length !== 0 || pendingResultMessage === null) {
    return;
  }
  const message = pendingResultMessage;
  pendingResultMessage = null;
  finalizeResultMessage(message);
}

function animateLiveFrameQueue() {
  if (liveFrameTimer !== null || liveFrameQueue.length === 0) return;
  const tick = () => {
    const message = liveFrameQueue.shift();
    if (message !== undefined) renderProgressMessage(message);
    if (liveFrameQueue.length > 0) {
      let nextDelayMs = message?.displayDelayMs ?? 110;
      if (pendingResultMessage !== null) {
        nextDelayMs = Math.min(nextDelayMs, Math.max(30, 8000 / liveFrameQueue.length));
      }
      liveFrameTimer = window.setTimeout(tick, nextDelayMs);
    } else {
      liveFrameTimer = null;
      finishPendingResultIfDrained();
    }
  };
  liveFrameTimer = window.setTimeout(tick, 0);
}

function enqueueLiveFrame(message) {
  liveFrameQueue.push(message);
  animateLiveFrameQueue();
}

function spawnWorker() {
  workerGeneration += 1;
  const generation = workerGeneration;
  runtimeReady = false;
  running = false;
  cancelling = false;
  continuationSignature = null;
  updateButtons();
  clearPublicError();
  startPreparationTimer();
  setStatus(
    'preparing',
    'status.loadingTitle',
    'status.loadingDetail',
  );
  if (latestResult === null) {
    showHeatmapWaitingState(
      'waiting.loadingTitle',
      'waiting.loadingDetail',
    );
  }

  const worker = new Worker(new URL('./simulation-worker.js?v=runtime-v20', import.meta.url), {
    type: 'module',
    name: `gaugefields-lite-${generation}`,
  });
  simulationWorker = worker;

  worker.addEventListener('message', event => {
    if (worker !== simulationWorker || generation !== workerGeneration) return;
    handleWorkerMessage(event.data);
  });
  worker.addEventListener('error', event => {
    if (worker !== simulationWorker || generation !== workerGeneration) return;
    showPublicError(event.message || 'The calculation worker stopped unexpectedly.', 'worker');
  });
}

function finalizeResultMessage(message) {
  try {
    const wasCancelled = message.type === 'cancelled';
    const wasViewUpdate = activeJob?.mode === 'view';
    const expectedSweeps = message.totalSweeps ?? activeJob.parameters.sweeps;
    const result = decodeWebResult(message.values, expectedSweeps);
    latestResult = result;
    latestParameters = activeJob.parameters;
    continuationSignature = message.canContinue === true
      ? parametersSignature(activeJob.parameters)
      : null;
    renderResult(result, latestParameters, message.live !== true);
    running = false;
    cancelling = false;
    runtimeReady = true;
    const wallElapsedMs = elapsedStartedAt === null
      ? message.elapsedMs
      : performance.now() - elapsedStartedAt;
    stopElapsedTimer();
    setElapsedDisplay(
      'elapsed.elapsed',
      { seconds: (wallElapsedMs / 1000).toFixed(1) },
      'elapsed.simulationAria',
    );
    updateButtons();
    updateReplayControl(result);
    clearPublicError();
    const titleKey = wasCancelled
      ? 'status.cancelledTitle'
      : (wasViewUpdate ? 'status.viewUpdatedTitle' : 'status.completedTitle');
    const detailKey = wasCancelled
      ? (result.sweeps === 1 ? 'status.cancelledOne' : 'status.cancelledOther')
      : (wasViewUpdate
        ? 'status.viewMeasured'
        : (result.sweeps === 1 ? 'status.measuredOne' : 'status.measuredOther'));
    setStatus(wasCancelled ? 'cancelled' : 'completed', titleKey, detailKey, {
      count: result.sweeps,
      plane: activeJob.parameters.plane,
      slice: activeJob.parameters.slice,
    });
    updateGuidedNarration({
      sweep: result.sweeps,
      totalSweeps: result.sweeps,
      completed: !wasCancelled && !wasViewUpdate,
    });
    if (message.maximumNormError !== undefined) {
      console.info('SU(2) maximum link norm error:', message.maximumNormError);
    }
  } catch (error) {
    showPublicError(error instanceof Error ? error.message : String(error), 'decode');
  }
}

function handleWorkerMessage(message) {
  if (message?.type === 'ready') {
    finishPreparationTimer(true);
    runtimeReady = true;
    running = false;
    if (latestResult === null) {
      frameIndicator.textContent = t('visualization.readyExperiment');
      heatmapSummary.textContent = t('visualization.resultsAfterRun');
      showGuidedWelcome();
    }
    updateButtons();
    setStatus('ready', 'status.readyTitle', 'status.readyDetail');
    console.info('GaugefieldsLite calculator ready');
    return;
  }

  if (message?.type === 'backend-ready') {
    console.info('GaugefieldsLite runtime ready:', message.backend, message.runtimeVersion);
    return;
  }

  if (message?.type === 'preparing-backend' && message.id === activeJob?.id) {
    setStatus('preparing', 'status.su3Title', 'status.su3Detail');
    if (latestResult === null) {
      showHeatmapWaitingState(
        'waiting.su3Title',
        'waiting.su3Detail',
      );
    }
    return;
  }

  if (message?.type === 'started' && message.id === activeJob?.id) {
    setStatus('running', 'status.runningTitle', 'status.runningDetail');
    if (latestResult === null) {
      showHeatmapWaitingState(
        'waiting.firstChunkTitle',
        'waiting.firstChunkDetail',
      );
    }
    return;
  }

  if (message?.type === 'progress' && message.id === activeJob?.id) {
    enqueueLiveFrame(message);
    return;
  }

  if (message?.type === 'result' && message.id === activeJob?.id) {
    pendingResultMessage = message;
    finishPendingResultIfDrained();
    return;
  }

  if (message?.type === 'cancelled' && message.id === activeJob?.id) {
    clearLiveFramePipeline();
    finalizeResultMessage(message);
    return;
  }

  if (message?.type === 'error') {
    if (message.id !== undefined && message.id !== activeJob?.id) return;
    showPublicError(message.detail ?? 'Unknown calculation error', message.stage);
  }
}

function startSimulation(event, mode = 'run') {
  event?.preventDefault();
  formError.hidden = true;
  clearPublicError();
  if (!runtimeReady || running || simulationWorker === null) return;

  if (mode === 'run' && !guidedSessionActive) hideGuidedExperience();

  if (mode === 'run' && latestResult !== null) {
    formError.textContent = t('error.runProtected');
    formError.hidden = false;
    updateButtons();
    return;
  }

  let parameters;
  try {
    parameters = readParameters();
  } catch (error) {
    formError.textContent = error instanceof WebContractError
      ? t('error.invalidSettings')
      : (error instanceof Error ? error.message : String(error));
    formError.hidden = false;
    return;
  }

  if ((mode === 'continue' || mode === 'view')
      && (continuationSignature === null
        || continuationSignature !== parametersSignature(parameters))) {
    formError.textContent = t('error.sameSettings');
    formError.hidden = false;
    updateButtons();
    return;
  }

  if (mode === 'view') parameters = { ...parameters, sweeps: 0 };

  jobSequence += 1;
  stopHeatmapPlayback();
  clearLiveFramePipeline();
  replayButton.disabled = true;
  if (mode === 'continue') {
    frameIndicator.textContent = t('waiting.continuation');
    heatmapSummary.textContent = t('waiting.continuationDetail');
  } else if (mode === 'view') {
    frameIndicator.textContent = t('waiting.view');
    heatmapSummary.textContent = t('waiting.viewDetail');
  } else {
    showHeatmapWaitingState(
      'waiting.startingTitle',
      'waiting.startingDetail',
    );
  }
  activeJob = { id: jobSequence, parameters, mode };
  running = true;
  cancelling = false;
  if (mode === 'run') continuationSignature = null;
  updateButtons();
  startElapsedTimer();
  setStatus(
    'running',
    mode === 'continue'
      ? 'status.continuingTitle'
      : (mode === 'view' ? 'status.updatingViewTitle' : 'status.startingTitle'),
    mode === 'continue'
      ? 'status.continuingDetail'
      : (mode === 'view'
        ? 'status.viewKeptDetail'
        : 'status.startingDetail'),
    { count: parameters.sweeps },
  );
  simulationWorker.postMessage({
    type: mode === 'view' ? 'continue' : mode,
    id: activeJob.id,
    parameters,
  });
}

function cancelSimulation() {
  if (!running || simulationWorker === null) return;
  cancelling = true;
  setStatus('cancelling', 'status.stoppingTitle', 'status.stoppingDetail');
  stopHeatmapPlayback();
  updateButtons();
  simulationWorker.postMessage({ type: 'cancel', id: activeJob.id });
}

function resetSimulation() {
  if (running) return;
  simulationWorker?.postMessage({ type: 'reset' });
  activeJob = null;
  continuationSignature = null;
  latestResult = null;
  latestParameters = null;
  guidedSessionActive = false;
  guidedProgress = null;
  playbackFrameIndex = 0;
  stopHeatmapPlayback();
  clearLiveFramePipeline();
  clearPublicError();
  setElapsedDisplay('elapsed.empty', {}, 'elapsed.simulationAria');
  replayButton.disabled = true;
  replaySlider.disabled = true;
  replaySlider.max = '0';
  replaySlider.value = '0';
  frameIndicator.textContent = t('visualization.readyExperiment');
  plaquetteValue.textContent = '—';
  polyakovValue.textContent = '—';
  acceptanceValue.textContent = '—';
  acceptanceDetail.textContent = algorithmInput.value === 'heatbath'
    ? t('observables.noHeatbath')
    : t('observables.noProposals');
  historyCount.textContent = sweepCountText(0);
  heatmapSummary.textContent = t('visualization.resultsAfterRun');
  showGuidedWelcome();
  setStatus('ready', 'status.readyTitle', 'status.readyDetail');
  updateButtons();
}

function retryPreparation() {
  if (simulationWorker !== null) simulationWorker.terminate();
  simulationWorker = null;
  activeJob = null;
  stopElapsedTimer();
  spawnWorker();
}

function canvasSurface(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  // Match the backing bitmap to the rendered CSS box exactly.  In the
  // viewport-fitting desktop layout the history chart may legitimately be
  // shorter than 180 px; drawing a taller bitmap and letting CSS squeeze it
  // distorts both the plot and its text.
  const width = Math.round(canvas.clientWidth) || 320;
  const height = Math.round(canvas.clientHeight) || 240;
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function drawCanvasMessage(canvas, message, dark = false, detail = '') {
  const { context, width, height } = canvasSurface(canvas);
  context.fillStyle = dark ? '#10101a' : '#fbfbfd';
  context.fillRect(0, 0, width, height);
  context.fillStyle = dark ? '#aaa9bc' : '#666672';
  context.font = '600 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(message, width / 2, height / 2 - (detail === '' ? 0 : 10));
  if (detail !== '') {
    context.fillStyle = dark ? '#79788d' : '#858590';
    context.font = '11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    context.fillText(detail, width / 2, height / 2 + 13);
  }
}

const HEAT_COLORS = [
  [11, 7, 30],
  [57, 18, 108],
  [154, 31, 94],
  [240, 91, 24],
  [255, 226, 82],
];

function heatColorChannels(unitValue) {
  const position = Math.max(0, Math.min(1, unitValue)) * (HEAT_COLORS.length - 1);
  const index = Math.min(HEAT_COLORS.length - 2, Math.floor(position));
  const fraction = position - index;
  const left = HEAT_COLORS[index];
  const right = HEAT_COLORS[index + 1];
  const channel = offset => Math.round(left[offset] + fraction * (right[offset] - left[offset]));
  return [channel(0), channel(1), channel(2)];
}

function heatColor(unitValue) {
  const [red, green, blue] = heatColorChannels(unitValue);
  return `rgb(${red}, ${green}, ${blue})`;
}

function addLandscapeColorStops(gradient) {
  const stopCount = 16;
  for (let stop = 0; stop <= stopCount; stop += 1) {
    const unitValue = stop / stopCount;
    const visibleActivity = Math.sqrt(unitValue);
    gradient.addColorStop(unitValue, heatColor(0.22 + visibleActivity * 0.78));
  }
}

function traceLandscapePolygon(context, points) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.closePath();
}

function shadedHeatColor(unitValue, brightness, alpha = 1) {
  const [red, green, blue] = heatColorChannels(unitValue);
  const shade = channel => Math.max(0, Math.min(255, Math.round(channel * brightness)));
  return `rgba(${shade(red)}, ${shade(green)}, ${shade(blue)}, ${alpha})`;
}

function drawLandscapeBuilding(context, baseCorners, lift, colorPosition) {
  const topCorners = baseCorners.map(corner => ({ x: corner.x, y: corner.y - lift }));
  const [back, right, front, left] = baseCorners;
  const [topBack, topRight, topFront, topLeft] = topCorners;

  const rightFace = [right, front, topFront, topRight];
  const leftFace = [front, left, topLeft, topFront];
  const topFace = [topBack, topRight, topFront, topLeft];

  const rightGradient = context.createLinearGradient(0, topRight.y, 0, right.y);
  rightGradient.addColorStop(0, shadedHeatColor(colorPosition, 0.82, 0.98));
  rightGradient.addColorStop(1, shadedHeatColor(colorPosition, 0.48, 0.96));
  traceLandscapePolygon(context, rightFace);
  context.fillStyle = rightGradient;
  context.fill();

  const leftGradient = context.createLinearGradient(0, topLeft.y, 0, left.y);
  leftGradient.addColorStop(0, shadedHeatColor(colorPosition, 1.02, 0.98));
  leftGradient.addColorStop(1, shadedHeatColor(colorPosition, 0.64, 0.96));
  traceLandscapePolygon(context, leftFace);
  context.fillStyle = leftGradient;
  context.fill();

  const topGradient = context.createLinearGradient(topBack.x, topBack.y, topFront.x, topFront.y);
  topGradient.addColorStop(0, shadedHeatColor(colorPosition, 1.42, 1));
  topGradient.addColorStop(1, shadedHeatColor(colorPosition, 1.08, 1));
  traceLandscapePolygon(context, topFace);
  context.fillStyle = topGradient;
  context.fill();

  context.strokeStyle = 'rgba(255, 249, 229, 0.24)';
  context.lineWidth = 0.75;
  for (const face of [rightFace, leftFace, topFace]) {
    traceLandscapePolygon(context, face);
    context.stroke();
  }
}

function drawLandscapeAxis(context, origin, endpoint, label) {
  const deltaX = endpoint.x - origin.x;
  const deltaY = endpoint.y - origin.y;
  const length = Math.hypot(deltaX, deltaY);
  const directionX = deltaX / length;
  const directionY = deltaY / length;
  const normalX = -directionY;
  const normalY = directionX;
  const tip = {
    x: endpoint.x + directionX * 5,
    y: endpoint.y + directionY * 5,
  };
  const arrowBase = {
    x: tip.x - directionX * 6,
    y: tip.y - directionY * 6,
  };

  context.strokeStyle = '#c8c3e4';
  context.fillStyle = '#c8c3e4';
  context.lineWidth = 1.1;
  context.beginPath();
  context.moveTo(endpoint.x - directionX * 7, endpoint.y - directionY * 7);
  context.lineTo(tip.x, tip.y);
  context.stroke();
  context.beginPath();
  context.moveTo(tip.x, tip.y);
  context.lineTo(arrowBase.x + normalX * 3, arrowBase.y + normalY * 3);
  context.lineTo(arrowBase.x - normalX * 3, arrowBase.y - normalY * 3);
  context.closePath();
  context.fill();

  context.font = '700 10px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  context.textBaseline = 'middle';
  context.textAlign = directionX > 0 ? 'left' : 'right';
  context.fillText(
    label,
    tip.x + directionX * 8,
    tip.y + directionY * 8,
  );
}

function drawActivityLandscape(result, parameters, frameIndex) {
  const { context, width, height } = canvasSurface(heatmapCanvas);
  const background = context.createRadialGradient(
    width * 0.46,
    height * 0.48,
    0,
    width * 0.46,
    height * 0.48,
    Math.max(width, height) * 0.72,
  );
  background.addColorStop(0, '#201938');
  background.addColorStop(0.48, '#111021');
  background.addColorStop(1, '#070710');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const values = result.sliceFrames[frameIndex];
  const { minimum, maximum } = heatmapColorRange(parameters.gaugeGroup);
  const columns = result.sliceWidth;
  const rows = result.sliceHeight;
  const basis = landscapePlaneBasis(parameters.plane);
  const legendSpace = 58;
  const gridSpan = Math.max(2, columns + rows);
  const topY = Math.max(72, height * 0.29);
  const horizontalStep = Math.max(6, Math.min(
    (width - legendSpace - 42) / gridSpan,
    (height - topY - 42) / (gridSpan * 0.46),
  ));
  const verticalStep = horizontalStep * 0.46;
  const centerX = (width - legendSpace) * 0.52;
  const point = (column, row) => ({
    x: centerX + (
      column * basis.firstDirection.x + row * basis.secondDirection.x
    ) * horizontalStep,
    y: topY + (
      column * basis.firstDirection.y + row * basis.secondDirection.y
    ) * horizontalStep,
  });

  const top = point(0, 0);
  const firstEnd = point(columns, 0);
  const front = point(columns, rows);
  const secondEnd = point(0, rows);
  const slabDepth = Math.max(5, verticalStep * 0.3);

  context.beginPath();
  context.moveTo(firstEnd.x, firstEnd.y);
  context.lineTo(front.x, front.y);
  context.lineTo(front.x, front.y + slabDepth);
  context.lineTo(firstEnd.x, firstEnd.y + slabDepth);
  context.closePath();
  context.fillStyle = 'rgba(66, 49, 113, 0.34)';
  context.fill();

  context.beginPath();
  context.moveTo(secondEnd.x, secondEnd.y);
  context.lineTo(front.x, front.y);
  context.lineTo(front.x, front.y + slabDepth);
  context.lineTo(secondEnd.x, secondEnd.y + slabDepth);
  context.closePath();
  context.fillStyle = 'rgba(34, 28, 66, 0.62)';
  context.fill();

  context.beginPath();
  context.moveTo(top.x, top.y);
  context.lineTo(firstEnd.x, firstEnd.y);
  context.lineTo(front.x, front.y);
  context.lineTo(secondEnd.x, secondEnd.y);
  context.closePath();
  const floor = context.createLinearGradient(top.x, top.y, front.x, front.y);
  floor.addColorStop(0, 'rgba(37, 29, 69, 0.92)');
  floor.addColorStop(1, 'rgba(12, 11, 28, 0.96)');
  context.fillStyle = floor;
  context.fill();
  context.strokeStyle = 'rgba(187, 176, 255, 0.42)';
  context.lineWidth = 1.2;
  context.stroke();

  context.strokeStyle = 'rgba(174, 164, 231, 0.23)';
  context.lineWidth = 0.8;
  for (let column = 0; column <= columns; column += 1) {
    const start = point(column, 0);
    const end = point(column, rows);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  for (let row = 0; row <= rows; row += 1) {
    const start = point(0, row);
    const end = point(columns, row);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  const sites = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      sites.push({ column, row, index: row * columns + column });
    }
  }
  sites.sort((leftSite, rightSite) =>
    (leftSite.column + leftSite.row) - (rightSite.column + rightSite.row));

  for (const site of sites) {
    const value = values[site.index];
    const unitValue = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
    const visibleActivity = Math.sqrt(unitValue);
    const colorPosition = Math.min(1, 0.22 + visibleActivity * 0.78);
    const inset = 0.2;
    const baseCorners = [
      point(site.column + inset, site.row + inset),
      point(site.column + inset, site.row + 1 - inset),
      point(site.column + 1 - inset, site.row + 1 - inset),
      point(site.column + 1 - inset, site.row + inset),
    ];
    const lift = Math.max(2, visibleActivity * Math.min(72, horizontalStep * 1.55));
    drawLandscapeBuilding(context, baseCorners, lift, colorPosition);
  }

  drawLandscapeAxis(context, top, firstEnd, basis.firstAxis);
  drawLandscapeAxis(context, top, secondEnd, basis.secondAxis);

  const legendX = width - 43;
  const legendTop = Math.max(72, height * 0.2);
  const legendHeight = Math.max(100, height - legendTop - 49);
  const gradient = context.createLinearGradient(0, legendTop + legendHeight, 0, legendTop);
  addLandscapeColorStops(gradient);
  context.fillStyle = gradient;
  context.fillRect(legendX, legendTop, 10, legendHeight);
  context.strokeStyle = 'rgba(255, 255, 255, 0.34)';
  context.strokeRect(legendX, legendTop, 10, legendHeight);
  context.fillStyle = '#aaa7bd';
  context.font = '9px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.fillText(maximum.toPrecision(3), legendX + 15, legendTop);
  context.textBaseline = 'bottom';
  context.fillText(minimum.toPrecision(3), legendX + 15, legendTop + legendHeight);

  const actualMaximum = Math.max(...values);
  const actualMinimum = Math.min(...values);
  const logicalFrame = result.currentSweep ?? (result.frameStartSweep ?? 0) + frameIndex;
  const totalSweeps = result.totalSweeps ?? result.sweeps;
  const frameLabel = logicalFrame === 0
    ? t('visualization.initialConfiguration')
    : t('visualization.sweepProgress', { current: logicalFrame, total: totalSweeps });
  frameIndicator.textContent = frameLabel;
  replaySlider.value = String(frameIndex);
  heatmapSummary.textContent = t('visualization.landscapeSummary', {
    frame: frameLabel,
    plane: parameters.plane,
    slice: parameters.slice,
    actualMin: actualMinimum.toPrecision(4),
    actualMax: actualMaximum.toPrecision(4),
    min: minimum.toPrecision(2),
    max: maximum.toPrecision(2),
  });
}

function drawHeatmap(result, parameters, frameIndex = result.frameCount - 1) {
  hideHeatmapWaitingState();
  if (visualizationModeInput.value === 'landscape') {
    drawActivityLandscape(result, parameters, frameIndex);
    return;
  }
  const { context, width, height } = canvasSurface(heatmapCanvas);
  context.fillStyle = '#10101a';
  context.fillRect(0, 0, width, height);

  const margin = { top: 22, right: 72, bottom: 46, left: 46 };
  const plotWidth = Math.max(80, width - margin.left - margin.right);
  const plotHeight = Math.max(80, height - margin.top - margin.bottom);
  const cellWidth = plotWidth / result.sliceWidth;
  const cellHeight = plotHeight / result.sliceHeight;
  const values = result.sliceFrames[frameIndex];
  const { minimum, maximum } = heatmapColorRange(parameters.gaugeGroup);

  for (let row = 0; row < result.sliceHeight; row += 1) {
    for (let column = 0; column < result.sliceWidth; column += 1) {
      const value = values[row * result.sliceWidth + column];
      const unitValue = (value - minimum) / (maximum - minimum);
      const x = margin.left + column * cellWidth;
      const y = margin.top + (result.sliceHeight - row - 1) * cellHeight;
      context.fillStyle = heatColor(unitValue);
      context.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);
      context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      context.lineWidth = 1;
      context.strokeRect(x, y, cellWidth, cellHeight);
      if (result.sliceWidth * result.sliceHeight <= 16) {
        context.fillStyle = unitValue > 0.64 ? '#18131d' : '#f6f3ff';
        context.font = `${Math.max(10, Math.min(14, cellWidth * 0.16))}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(value.toPrecision(3), x + cellWidth / 2, y + cellHeight / 2);
      }
    }
  }

  const gradientX = width - 43;
  const gradient = context.createLinearGradient(0, margin.top + plotHeight, 0, margin.top);
  HEAT_COLORS.forEach((color, index) => {
    gradient.addColorStop(index / (HEAT_COLORS.length - 1), `rgb(${color.join(',')})`);
  });
  context.fillStyle = gradient;
  context.fillRect(gradientX, margin.top, 12, plotHeight);
  context.strokeStyle = 'rgba(255,255,255,0.35)';
  context.strokeRect(gradientX, margin.top, 12, plotHeight);

  context.fillStyle = '#d0d0dd';
  context.font = '11px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.fillText(maximum.toPrecision(3), gradientX + 18, margin.top);
  context.textBaseline = 'bottom';
  context.fillText(minimum.toPrecision(3), gradientX + 18, margin.top + plotHeight);

  const firstAxis = parameters.plane[0];
  const secondAxis = parameters.plane[1];
  context.fillStyle = '#f0f0f6';
  context.font = '12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  context.textAlign = 'center';
  context.fillText(firstAxis, margin.left + plotWidth / 2, height - 14);
  context.save();
  context.translate(14, margin.top + plotHeight / 2);
  context.rotate(-Math.PI / 2);
  context.fillText(secondAxis, 0, 0);
  context.restore();

  const actualMaximum = Math.max(...values);
  const actualMinimum = Math.min(...values);
  const logicalFrame = result.currentSweep ?? (result.frameStartSweep ?? 0) + frameIndex;
  const totalSweeps = result.totalSweeps ?? result.sweeps;
  const frameLabel = logicalFrame === 0
    ? t('visualization.initialConfiguration')
    : t('visualization.sweepProgress', { current: logicalFrame, total: totalSweeps });
  frameIndicator.textContent = frameLabel;
  replaySlider.value = String(frameIndex);
  heatmapSummary.textContent = t('visualization.heatmapSummary', {
    frame: frameLabel,
    plane: parameters.plane,
    slice: parameters.slice,
    actualMin: actualMinimum.toPrecision(4),
    actualMax: actualMaximum.toPrecision(4),
    min: minimum.toPrecision(2),
    max: maximum.toPrecision(2),
  });
}

function startHeatmapReplay(result, parameters) {
  stopHeatmapPlayback();
  playbackFrameIndex = 0;
  drawHeatmap(result, parameters, playbackFrameIndex);
  if (result.frameCount <= 1) {
    updateReplayControl(result);
    return;
  }

  continueHeatmapReplay(result, parameters);
}

function continueHeatmapReplay(result, parameters) {
  playbackPaused = false;
  const frameInterval = Math.max(60, Math.min(850, 8000 / (result.frameCount - 1)));
  playbackTimer = window.setInterval(() => {
    playbackFrameIndex += 1;
    drawHeatmap(result, parameters, playbackFrameIndex);
    if (playbackFrameIndex === result.frameCount - 1) stopHeatmapPlayback();
  }, frameInterval);
  updateReplayControl(result);
}

function pauseHeatmapReplay() {
  if (playbackTimer === null) return;
  stopHeatmapPlayback({ paused: true });
}

function drawHistory(result) {
  if (result.plaquetteHistory.length === 0) {
    drawCanvasMessage(historyCanvas, t('visualization.noHistoryZero'));
    return;
  }
  const { context, width, height } = canvasSurface(historyCanvas);
  context.fillStyle = '#fbfbfd';
  context.fillRect(0, 0, width, height);
  const margin = { top: 17, right: 15, bottom: 28, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  let minimum = Math.min(...result.plaquetteHistory);
  let maximum = Math.max(...result.plaquetteHistory);
  const padding = Math.max(0.01, (maximum - minimum) * 0.12);
  minimum -= padding;
  maximum += padding;

  context.strokeStyle = '#e2e2e9';
  context.fillStyle = '#797985';
  context.font = '10px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  context.lineWidth = 1;
  for (let grid = 0; grid <= 4; grid += 1) {
    const y = margin.top + (grid / 4) * plotHeight;
    context.beginPath();
    context.moveTo(margin.left, y);
    context.lineTo(margin.left + plotWidth, y);
    context.stroke();
    const value = maximum - (grid / 4) * (maximum - minimum);
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    context.fillText(value.toFixed(3), margin.left - 7, y);
  }

  context.strokeStyle = '#6557df';
  context.lineWidth = 2.2;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.beginPath();
  result.plaquetteHistory.forEach((value, index) => {
    const fraction = result.plaquetteHistory.length === 1 ? 0.5 : index / (result.plaquetteHistory.length - 1);
    const x = margin.left + fraction * plotWidth;
    const y = margin.top + ((maximum - value) / (maximum - minimum)) * plotHeight;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  context.fillStyle = '#6557df';
  result.plaquetteHistory.forEach((value, index) => {
    const fraction = result.plaquetteHistory.length === 1 ? 0.5 : index / (result.plaquetteHistory.length - 1);
    const x = margin.left + fraction * plotWidth;
    const y = margin.top + ((maximum - value) / (maximum - minimum)) * plotHeight;
    context.beginPath();
    context.arc(x, y, 2.8, 0, Math.PI * 2);
    context.fill();
  });

  context.fillStyle = '#777783';
  context.textBaseline = 'bottom';
  context.textAlign = 'left';
  context.fillText('1', margin.left, height - 5);
  context.textAlign = 'right';
  context.fillText(String(result.sweeps), margin.left + plotWidth, height - 5);
}

function renderLiveFrame(frame, parameters) {
  stopHeatmapPlayback();
  replayButton.disabled = true;
  plaquetteValue.textContent = frame.plaquette.toFixed(6);
  polyakovValue.textContent = Math.hypot(frame.polyakovReal, frame.polyakovImag).toFixed(6);
  if (frame.offered === 0) {
    acceptanceValue.textContent = '—';
    setMetricCopy(
      parameters.algorithm === 'heatbath'
        ? 'observables.linksUpdated'
        : 'observables.acceptanceRate',
      parameters.algorithm === 'heatbath'
        ? 'observables.noHeatbath'
        : 'observables.noProposals',
    );
  } else if (parameters.algorithm === 'heatbath') {
    acceptanceValue.textContent = `${frame.accepted}`;
    setMetricCopy('observables.linksUpdated', 'observables.heatbathDetail');
  } else {
    acceptanceValue.textContent = `${(100 * frame.acceptance).toFixed(1)}%`;
    setMetricCopy('observables.acceptanceRate', 'observables.acceptedDetail', {
      accepted: frame.accepted,
      offered: frame.offered,
    });
  }
  historyCount.textContent = t('observables.historyProgress', {
    current: frame.sweep,
    total: frame.totalSweeps,
  });

  const liveResult = {
    sweeps: frame.sweep,
    totalSweeps: frame.totalSweeps,
    currentSweep: frame.sweep,
    frameCount: 1,
    sliceWidth: frame.sliceWidth,
    sliceHeight: frame.sliceHeight,
    sliceFrames: [frame.sliceValues],
    sliceValues: frame.sliceValues,
    plaquetteHistory: frame.plaquetteHistory,
  };
  latestResult = liveResult;
  latestParameters = parameters;
  playbackFrameIndex = 0;
  drawHeatmap(liveResult, parameters, 0);
  drawHistory(liveResult);
}

function renderResult(result, parameters, autoReplay = true) {
  plaquetteValue.textContent = result.finalPlaquette.toFixed(6);
  polyakovValue.textContent = result.finalPolyakovMagnitude.toFixed(6);
  if (result.offered === 0) {
    acceptanceValue.textContent = '—';
    setMetricCopy(
      parameters.algorithm === 'heatbath'
        ? 'observables.linksUpdated'
        : 'observables.acceptanceRate',
      parameters.algorithm === 'heatbath'
        ? 'observables.noHeatbathZero'
        : 'observables.noProposalsZero',
    );
  } else if (parameters.algorithm === 'heatbath') {
    acceptanceValue.textContent = `${result.accepted}`;
    setMetricCopy('observables.linksUpdated', 'observables.heatbathDetail');
  } else {
    acceptanceValue.textContent = `${(100 * result.overallAcceptance).toFixed(1)}%`;
    setMetricCopy('observables.acceptanceRate', 'observables.acceptedDetail', {
      accepted: result.accepted,
      offered: result.offered,
    });
  }
  historyCount.textContent = sweepCountText(result.sweeps);
  if (autoReplay && !prefersReducedMotion) {
    startHeatmapReplay(result, parameters);
  } else {
    stopHeatmapPlayback();
    playbackFrameIndex = result.frameCount - 1;
    drawHeatmap(result, parameters, playbackFrameIndex);
    updateReplayControl(result);
  }
  drawHistory(result);
}

function redrawLatestResult() {
  if (latestResult !== null && latestParameters !== null) {
    drawHeatmap(latestResult, latestParameters, playbackFrameIndex);
    drawHistory(latestResult);
  } else {
    if (running) {
      showHeatmapWaitingState(
        'waiting.firstChunkTitle',
        'waiting.firstChunkDetail',
      );
    } else if (!runtimeReady) {
      showHeatmapWaitingState(
        'waiting.loadingTitle',
        'waiting.loadingDetail',
      );
    } else {
      hideHeatmapWaitingState();
      drawCanvasMessage(heatmapCanvas, t('visualization.runToView'), true);
    }
    drawCanvasMessage(historyCanvas, t('visualization.historyPlaceholder'));
  }
}

function localizeDynamicUi() {
  languageSelector.value = getLanguage();
  setStatus(
    currentStatus.state,
    currentStatus.titleKey,
    currentStatus.detailKey,
    currentStatus.variables,
  );
  setElapsedDisplay(currentElapsed.key, currentElapsed.variables, currentElapsed.ariaKey);
  setMetricCopy(
    currentMetricCopy.labelKey,
    currentMetricCopy.detailKey,
    currentMetricCopy.variables,
  );
  updateAlgorithmAvailability();
  updateButtons();
  updateVisualizationMode({ redraw: false });
  updateReplayControl(latestResult);

  if (guidedSessionActive && guidedProgress !== null) {
    updateGuidedNarration(guidedProgress);
  }
  if (latestResult !== null && latestParameters !== null) {
    redrawLatestResult();
    const currentSweep = latestResult.currentSweep;
    const totalSweeps = latestResult.totalSweeps;
    historyCount.textContent = Number.isFinite(currentSweep) && Number.isFinite(totalSweeps)
      ? t('observables.historyProgress', { current: currentSweep, total: totalSweeps })
      : sweepCountText(latestResult.sweeps);
  } else if (currentWaiting !== null && !activityWaiting.hidden) {
    showHeatmapWaitingState(
      currentWaiting.titleKey,
      currentWaiting.detailKey,
      currentWaiting.variables,
    );
  } else if (runtimeReady && !running) {
    showGuidedWelcome();
    historyCount.textContent = sweepCountText(0);
    drawCanvasMessage(historyCanvas, t('visualization.historyPlaceholder'));
  } else {
    redrawLatestResult();
  }
  if (latestResult === null) {
    historyCount.textContent = sweepCountText(0);
    drawCanvasMessage(historyCanvas, t('visualization.historyPlaceholder'));
  }
}

let resizeFrame = null;
window.addEventListener('resize', () => {
  if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = null;
    redrawLatestResult();
  });
});

latticeInput.addEventListener('change', () => {
  updateSliceBounds();
  updateAlgorithmAvailability();
});
planeInput.addEventListener('change', () => {
  updateSliceBounds();
  updateButtons();
});
sliceInput.addEventListener('input', updateButtons);
sliceInput.addEventListener('change', updateButtons);
visualizationModeInput.addEventListener('change', updateVisualizationMode);
gaugeGroupInput.addEventListener('change', () => updateGaugeGroup({ restoreBeta: true }));
algorithmInput.addEventListener('change', updateAlgorithm);
form.addEventListener('submit', event => startSimulation(event, 'run'));
form.addEventListener('input', updateButtons);
form.addEventListener('change', updateButtons);
continueButton.addEventListener('click', event => startSimulation(event, 'continue'));
viewPlaneButton.addEventListener('click', event => startSimulation(event, 'view'));
resetButton.addEventListener('click', resetSimulation);
cancelButton.addEventListener('click', cancelSimulation);
retryButton.addEventListener('click', retryPreparation);
replayButton.addEventListener('click', () => {
  if (latestResult === null || latestParameters === null) return;
  if (playbackTimer !== null) {
    pauseHeatmapReplay();
  } else if (playbackPaused) {
    continueHeatmapReplay(latestResult, latestParameters);
  } else {
    startHeatmapReplay(latestResult, latestParameters);
  }
});
replaySlider.addEventListener('input', () => {
  if (latestResult === null || latestParameters === null || running) return;
  const requestedFrame = Number(replaySlider.value);
  stopHeatmapPlayback({ paused: requestedFrame < latestResult.frameCount - 1 });
  playbackFrameIndex = requestedFrame;
  drawHeatmap(latestResult, latestParameters, playbackFrameIndex);
  updateReplayControl(latestResult);
});
guidedStartButton.addEventListener('click', startGuidedExperiment);
languageSelector.addEventListener('change', () => {
  setLanguage(languageSelector.value);
  updateLanguageInUrl(languageSelector.value);
  localizeDynamicUi();
});

languageSelector.value = getLanguage();
updateSliceBounds();
updateGaugeGroup();
updateAlgorithmAvailability();
updateVisualizationMode();
updateButtons();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(error => {
    console.warn('GaugefieldsLite offline cache is unavailable:', error);
  });
}

window.requestAnimationFrame(spawnWorker);
