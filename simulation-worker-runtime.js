import init, {
  get_version,
  ReplSession,
  run_from_source_typed,
} from './vendor/subset_julia/subset_julia_vm_web.js?v=runtime-v20';

import {
  WEB_RESULT_SCHEMA_VERSION,
  buildSimulationChunkDriver,
  buildWebSu3SessionChunkDriver,
  buildWebSu3SessionStartDriver,
  buildWebSessionChunkDriver,
  buildWebSessionStartDriver,
  chooseAdaptiveChunkSize,
  decodeWebChunkResult,
  extractTypedNumericValues,
} from './result-contract.mjs?v=runtime-v20';

const INITIAL_CHUNK_SWEEPS = 5;
const TARGET_CHUNK_MS = 8000;
const MAXIMUM_CHUNK_SWEEPS = 32;
const GENERIC_TARGET_CHUNK_MS = 30000;
const GENERIC_MAXIMUM_CHUNK_SWEEPS = 64;
const SU3_INITIAL_CHUNK_SWEEPS = 1;
const SU3_TARGET_CHUNK_MS = 4000;
const SU3_MAXIMUM_CHUNK_SWEEPS = 4;
const REPL_FRAGMENT_SEPARATOR = '\n#= GAUGEFIELDSLITE_REPL_FRAGMENT =#\n';

let bundleSource = '';
let su3BundleSource = '';
let subsetReady = false;
let subsetPreparation = null;
let runtimeSession = null;
let su3RuntimeSession = null;
let su3RuntimeReady = false;
let su3RuntimePreparation = null;
let running = false;
let simulationSession = null;
let activeJobId = null;
let cancelRequested = false;

function errorDetail(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ''}`;
  return String(error);
}

function settingsSignature(parameters) {
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

function viewSettingsSignature(parameters) {
  return JSON.stringify({
    plane: parameters.plane,
    slice: parameters.slice,
  });
}

function createSession(parameters) {
  return {
    signature: settingsSignature(parameters),
    viewSignature: viewSettingsSignature(parameters),
    initialized: false,
    completedSweeps: 0,
    rngState: parameters.seed,
    configuration: [],
    accepted: 0,
    offered: 0,
    finalPlaquette: 0,
    finalPolyakovReal: 0,
    finalPolyakovImag: 0,
    sliceWidth: 0,
    sliceHeight: 0,
    plaquetteHistory: [],
    polyakovRealHistory: [],
    polyakovImagHistory: [],
    acceptanceHistory: [],
    sliceFrames: [],
  };
}

function encodeSessionResult(session) {
  const output = [
    WEB_RESULT_SCHEMA_VERSION,
    session.completedSweeps,
    session.finalPlaquette,
    session.finalPolyakovReal,
    session.finalPolyakovImag,
    session.offered === 0 ? 0 : session.accepted / session.offered,
    session.accepted,
    session.offered,
    session.sliceWidth,
    session.sliceHeight,
    session.sliceFrames.length,
    ...session.plaquetteHistory,
    ...session.polyakovRealHistory,
    ...session.polyakovImagHistory,
    ...session.acceptanceHistory,
  ];
  for (const frame of session.sliceFrames) output.push(...frame);
  return output;
}

function appendChunk(session, chunk) {
  session.initialized = true;
  session.completedSweeps = chunk.completedSweeps;
  session.rngState = chunk.rngState;
  session.configuration = chunk.configuration;
  session.accepted += chunk.accepted;
  session.offered += chunk.offered;
  session.finalPlaquette = chunk.finalPlaquette;
  session.finalPolyakovReal = chunk.finalPolyakovReal;
  session.finalPolyakovImag = chunk.finalPolyakovImag;
  session.sliceWidth = chunk.sliceWidth;
  session.sliceHeight = chunk.sliceHeight;
  session.plaquetteHistory.push(...chunk.plaquetteHistory);
  session.polyakovRealHistory.push(...chunk.polyakovRealHistory);
  session.polyakovImagHistory.push(...chunk.polyakovImagHistory);
  session.acceptanceHistory.push(...chunk.acceptanceHistory);
  session.sliceFrames.push(...(
    session.sliceFrames.length === 0 ? chunk.sliceFrames : chunk.sliceFrames.slice(1)
  ));
}

function postSessionOutcome(type, message, startedAt) {
  self.postMessage({
    type,
    id: message.id,
    backend: 'subset-julia',
    live: true,
    values: encodeSessionResult(simulationSession),
    totalSweeps: simulationSession.completedSweeps,
    canContinue: true,
    elapsedMs: performance.now() - startedAt,
  });
}

function yieldToWorkerMessages() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function postChunkFrames(message, session, chunk, targetSweeps, startedAt, displayDelayMs) {
  const volume = message.parameters.latticeExtents.reduce((product, extent) => product * extent, 1);
  const offeredPerSweep = 4 * volume;
  const historyBeforeChunk = session.plaquetteHistory.slice();
  let accepted = session.accepted;
  let offered = session.offered;
  for (let index = 0; index < chunk.chunkSweeps; index += 1) {
    accepted += Math.round(chunk.acceptanceHistory[index] * offeredPerSweep);
    offered += offeredPerSweep;
    self.postMessage({
      type: 'progress',
      id: message.id,
      backend: 'subset-julia',
      elapsedMs: performance.now() - startedAt,
      displayDelayMs,
      frame: {
        sweep: session.completedSweeps + index + 1,
        totalSweeps: targetSweeps,
        accepted,
        offered,
        acceptance: offered === 0 ? null : accepted / offered,
        plaquette: chunk.plaquetteHistory[index],
        polyakovReal: chunk.polyakovRealHistory[index],
        polyakovImag: chunk.polyakovImagHistory[index],
        sliceWidth: chunk.sliceWidth,
        sliceHeight: chunk.sliceHeight,
        sliceValues: chunk.sliceFrames[index + 1],
        plaquetteHistory: historyBeforeChunk.concat(chunk.plaquetteHistory.slice(0, index + 1)),
      },
    });
  }
}

async function prepareSubsetRuntime() {
  if (subsetReady) return;
  if (subsetPreparation !== null) return subsetPreparation;
  subsetPreparation = (async () => {
    const bundleRequest = fetch('./gaugefields-lite.bundle.jl?v=runtime-v20', { cache: 'force-cache' });
    const su2BundleRequest = fetch('./gaugefields-lite-su2.repl.jl?v=runtime-v20', { cache: 'force-cache' });
    const su3BundleRequest = fetch('./gaugefields-lite-su3.repl.jl?v=runtime-v20', { cache: 'force-cache' });
    const wasmRequest = fetch(new URL(
      './vendor/subset_julia/subset_julia_vm_web_bg.wasm?v=runtime-v20',
      import.meta.url,
    ), { cache: 'force-cache' });
    await init(await wasmRequest);
    const bundleResponse = await bundleRequest;
    const su2BundleResponse = await su2BundleRequest;
    const su3BundleResponse = await su3BundleRequest;
    if (!bundleResponse.ok || !su2BundleResponse.ok || !su3BundleResponse.ok) {
      throw new Error(`Unable to load simulation source: HTTP ${bundleResponse.status}`);
    }
    bundleSource = await bundleResponse.text();
    su3BundleSource = await su3BundleResponse.text();
    runtimeSession = new ReplSession(1n);
    const su2BundleSource = await su2BundleResponse.text();
    for (const fragment of su2BundleSource.split(REPL_FRAGMENT_SEPARATOR)) {
      const preparation = runtimeSession.eval_typed(fragment);
      if (preparation.success !== true) {
        throw new Error(preparation.error_message ?? 'Runtime preparation failed');
      }
    }
    subsetReady = true;
    self.postMessage({
      type: 'backend-ready',
      backend: 'subset-julia',
      runtimeVersion: get_version(),
    });
  })();
  try {
    await subsetPreparation;
  } catch (error) {
    subsetPreparation = null;
    throw error;
  }
}

async function preparePersistentSu3Runtime(message) {
  if (su3RuntimeReady) return;
  if (su3RuntimePreparation !== null) return su3RuntimePreparation;
  self.postMessage({ type: 'preparing-backend', id: message.id, backend: 'subset-julia' });
  su3RuntimePreparation = (async () => {
    su3RuntimeSession = new ReplSession(1n);
    for (const fragment of su3BundleSource.split(REPL_FRAGMENT_SEPARATOR)) {
      const preparation = su3RuntimeSession.eval_typed(fragment);
      if (preparation.success !== true) {
        throw new Error(preparation.error_message ?? 'SU(3) runtime preparation failed');
      }
      await yieldToWorkerMessages();
    }
    su3RuntimeReady = true;
  })();
  try {
    await su3RuntimePreparation;
    self.postMessage({ type: 'started', id: message.id, backend: 'subset-julia' });
  } catch (error) {
    su3RuntimePreparation = null;
    throw error;
  }
}

async function runChunkedJob(message, executionPlan) {
  await prepareSubsetRuntime();
  if (executionPlan.prepare !== undefined) await executionPlan.prepare(message);
  const continuing = message.type === 'continue';
  if (continuing) {
    if (simulationSession === null
        || simulationSession.signature !== settingsSignature(message.parameters)) {
      throw new Error('There is no matching Julia/WASM configuration to continue');
    }
  } else {
    simulationSession = createSession(message.parameters);
  }
  let replaceView = continuing
    && simulationSession.viewSignature !== viewSettingsSignature(message.parameters);

  const startedAt = performance.now();
  const targetSweeps = simulationSession.completedSweeps + message.parameters.sweeps;
  if (targetSweeps > 1000) {
    throw new Error('The cumulative sweep count must not exceed 1000');
  }
  const contractParameters = { ...message.parameters, sweeps: targetSweeps };
  let remainingSweeps = message.parameters.sweeps;
  let chunkSweeps = Math.min(
    executionPlan.initialChunkSweeps ?? INITIAL_CHUNK_SWEEPS,
    remainingSweeps,
  );
  let firstCall = true;

  while (firstCall || remainingSweeps > 0) {
    firstCall = false;
    const driver = executionPlan.buildDriver(
      contractParameters,
      chunkSweeps,
      simulationSession,
      replaceView,
    );
    const {
      execution,
      callElapsedMs,
      schedulerElapsedMs,
    } = executionPlan.execute(driver, message);
    if (execution.success !== true) {
      throw new Error(execution.error_message ?? 'Simulation execution failed');
    }
    const chunk = decodeWebChunkResult(
      extractTypedNumericValues(execution.typed_value),
      contractParameters,
    );
    remainingSweeps = targetSweeps - chunk.completedSweeps;
    const nextChunk = remainingSweeps === 0 ? 0 : chooseAdaptiveChunkSize({
      currentChunk: chunkSweeps,
      elapsedMs: schedulerElapsedMs,
      remainingSweeps,
      targetMs: executionPlan.targetChunkMs,
      maximum: executionPlan.maximumChunkSweeps,
    });
    const predictedNextMs = nextChunk === 0
      ? Math.min(1200, callElapsedMs)
      : callElapsedMs * nextChunk / Math.max(1, chunkSweeps);
    const displayDelayMs = Math.max(
      80,
      Math.min(2200, predictedNextMs / Math.max(1, chunk.chunkSweeps)),
    );
    postChunkFrames(
      message,
      simulationSession,
      chunk,
      targetSweeps,
      startedAt,
      displayDelayMs,
    );
    if (replaceView) {
      simulationSession.sliceFrames = [];
      simulationSession.viewSignature = viewSettingsSignature(message.parameters);
      replaceView = false;
    }
    appendChunk(simulationSession, chunk);
    chunkSweeps = nextChunk;

    // SubsetJulia executes each WASM call synchronously. Yield only after the
    // completed chunk has been checkpointed so a queued cancel request can be
    // handled without discarding configuration or RNG state.
    await yieldToWorkerMessages();
    if (cancelRequested) {
      postSessionOutcome('cancelled', message, startedAt);
      return;
    }
  }

  postSessionOutcome('result', message, startedAt);
}

const persistentSu2ExecutionPlan = {
  targetChunkMs: TARGET_CHUNK_MS,
  maximumChunkSweeps: MAXIMUM_CHUNK_SWEEPS,
  buildDriver(parameters, chunkSweeps, session, replaceView) {
    return session.initialized
      ? buildWebSessionChunkDriver(chunkSweeps, replaceView ? parameters : undefined)
      : buildWebSessionStartDriver(parameters, chunkSweeps);
  },
  execute(driver) {
    const callStartedAt = performance.now();
    const execution = runtimeSession.eval_typed(driver);
    const callElapsedMs = performance.now() - callStartedAt;
    const compileMs = runtimeSession.last_compile_ms();
    return {
      execution,
      callElapsedMs,
      schedulerElapsedMs: Math.max(
        1,
        callElapsedMs - (Number.isFinite(compileMs) ? compileMs : 0),
      ),
    };
  },
};

const checkpointedGenericExecutionPlan = {
  targetChunkMs: GENERIC_TARGET_CHUNK_MS,
  maximumChunkSweeps: GENERIC_MAXIMUM_CHUNK_SWEEPS,
  buildDriver(parameters, chunkSweeps, session) {
    return buildSimulationChunkDriver(parameters, {
      chunkSweeps,
      completedSweeps: session.completedSweeps,
      rngState: session.rngState,
      configuration: session.configuration,
    });
  },
  execute(driver, message) {
    const callStartedAt = performance.now();
    const execution = run_from_source_typed(
      `${bundleSource}\n\n${driver}`,
      BigInt(message.parameters.seed),
    );
    const callElapsedMs = performance.now() - callStartedAt;
    return { execution, callElapsedMs, schedulerElapsedMs: callElapsedMs };
  },
};

const persistentSu3ExecutionPlan = {
  initialChunkSweeps: SU3_INITIAL_CHUNK_SWEEPS,
  targetChunkMs: SU3_TARGET_CHUNK_MS,
  maximumChunkSweeps: SU3_MAXIMUM_CHUNK_SWEEPS,
  prepare: preparePersistentSu3Runtime,
  buildDriver(parameters, chunkSweeps, session, replaceView) {
    return session.initialized
      ? buildWebSu3SessionChunkDriver(chunkSweeps, replaceView ? parameters : undefined)
      : buildWebSu3SessionStartDriver(parameters, chunkSweeps);
  },
  execute(driver) {
    const callStartedAt = performance.now();
    const execution = su3RuntimeSession.eval_typed(driver);
    const callElapsedMs = performance.now() - callStartedAt;
    const compileMs = su3RuntimeSession.last_compile_ms();
    return {
      execution,
      callElapsedMs,
      schedulerElapsedMs: Math.max(
        1,
        callElapsedMs - (Number.isFinite(compileMs) ? compileMs : 0),
      ),
    };
  },
};

function runPersistentSu2Job(message) {
  return runChunkedJob(message, persistentSu2ExecutionPlan);
}

function runCheckpointedGenericJob(message) {
  return runChunkedJob(message, checkpointedGenericExecutionPlan);
}

function runPersistentSu3Job(message) {
  return runChunkedJob(message, persistentSu3ExecutionPlan);
}

self.addEventListener('message', async event => {
  const message = event.data;
  if (message?.type === 'cancel') {
    if (running && message.id === activeJobId) cancelRequested = true;
    return;
  }
  if (message?.type === 'reset') {
    if (!running) simulationSession = null;
    return;
  }
  if (message?.type !== 'run' && message?.type !== 'continue') return;
  if (running) {
    self.postMessage({
      type: 'error',
      id: message.id,
      stage: 'dispatch',
      detail: 'A simulation is already running',
    });
    return;
  }

  running = true;
  activeJobId = message.id;
  cancelRequested = false;
  self.postMessage({ type: 'started', id: message.id, backend: 'subset-julia' });
  try {
    if (message.parameters.gaugeGroup === 'SU3') {
      await runPersistentSu3Job(message);
    } else if (message.parameters.gaugeGroup === 'SU2'
        && message.parameters.latticeExtents.every(extent => extent > 1)) {
      await runPersistentSu2Job(message);
    } else {
      await runCheckpointedGenericJob(message);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id: message.id,
      stage: subsetReady ? 'run' : 'prepare',
      detail: errorDetail(error),
    });
  } finally {
    running = false;
    activeJobId = null;
    cancelRequested = false;
  }
});

prepareSubsetRuntime()
  .then(() => self.postMessage({ type: 'ready', backend: 'subset-julia' }))
  .catch(error => self.postMessage({
    type: 'error',
    stage: 'worker',
    detail: errorDetail(error),
  }));
