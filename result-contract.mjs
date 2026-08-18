export const WEB_RESULT_SCHEMA_VERSION = 2;
export const WEB_RESULT_HEADER_LENGTH = 11;
export const WEB_CHUNK_SCHEMA_VERSION = 1;
export const WEB_SESSION_CHUNK_SCHEMA_VERSION = 2;
export const WEB_CHUNK_HEADER_LENGTH = 19;
export const MAX_SAFE_SEED = Number.MAX_SAFE_INTEGER;

const VALID_CONDITIONS = new Set(['cold', 'hot']);
const VALID_PLANES = new Set(['xy', 'xz', 'xt', 'yz', 'yt', 'zt']);
const VALID_GAUGE_GROUPS = new Set(['SU2', 'SU3']);
const VALID_ALGORITHMS = new Set(['metropolis', 'heatbath']);
export const DEFAULT_BETA_BY_GAUGE_GROUP = Object.freeze({ SU2: 2.3, SU3: 5.7 });
export const LOCAL_ACTION_DENSITY_COLOR_RANGE = Object.freeze({
  SU2: Object.freeze({ minimum: 0, maximum: 12 }),
  SU3: Object.freeze({ minimum: 0, maximum: 9 }),
});

export function heatmapColorRange(gaugeGroup) {
  const range = LOCAL_ACTION_DENSITY_COLOR_RANGE[gaugeGroup];
  if (range === undefined) throw new WebContractError('unsupported gauge group for heatmap');
  return range;
}

const LANDSCAPE_FIRST_DIRECTION = Object.freeze({ x: -1, y: 0.46 });
const LANDSCAPE_SECOND_DIRECTION = Object.freeze({ x: 1, y: 0.46 });
const LANDSCAPE_ACTIVITY_DIRECTION = Object.freeze({ x: 0, y: -1 });

export function landscapePlaneBasis(plane) {
  if (!VALID_PLANES.has(plane)) {
    throw new WebContractError('unsupported plane for landscape');
  }
  return Object.freeze({
    firstAxis: plane[0],
    secondAxis: plane[1],
    firstDirection: LANDSCAPE_FIRST_DIRECTION,
    secondDirection: LANDSCAPE_SECOND_DIRECTION,
    activityDirection: LANDSCAPE_ACTIVITY_DIRECTION,
  });
}

export function heatbathSupportsLattice(latticeExtents) {
  return Array.isArray(latticeExtents)
    && latticeExtents.length === 4
    && latticeExtents.every(extent => Number.isSafeInteger(extent) && extent > 1);
}
const AXIS_INDEX = Object.freeze({ x: 0, y: 1, z: 2, t: 3 });

export class WebContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WebContractError';
  }
}

function requireFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WebContractError(`${name} must be a finite number`);
  }
  return value;
}

function requireInteger(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new WebContractError(`${name} must be an integer in ${minimum}:${maximum}`);
  }
  return value;
}

export function validateSimulationParameters(input) {
  const gaugeGroup = input.gaugeGroup ?? 'SU3';
  if (!VALID_GAUGE_GROUPS.has(gaugeGroup)) {
    throw new WebContractError('gauge group is invalid');
  }
  const rawExtents = input.latticeExtents ?? [
    input.latticeSize,
    input.latticeSize,
    input.latticeSize,
    input.latticeSize,
  ];
  if (!Array.isArray(rawExtents) || rawExtents.length !== 4) {
    throw new WebContractError('lattice extents must contain x, y, z, and t');
  }
  const latticeExtents = rawExtents.map((value, index) =>
    requireInteger(value, `lattice extent ${'xyzt'[index]}`, 1, 8));
  const sweeps = requireInteger(input.sweeps, 'sweeps', 0, 1000);
  const seed = requireInteger(input.seed, 'seed', 0, MAX_SAFE_SEED);
  const beta = requireFiniteNumber(input.beta, 'beta');
  const epsilon = requireFiniteNumber(input.epsilon, 'proposal strength');
  const algorithm = input.algorithm ?? 'metropolis';

  if (beta < 0) throw new WebContractError('beta must be nonnegative');
  if (epsilon <= 0 || epsilon > 1) {
    throw new WebContractError('proposal strength must satisfy 0 < epsilon <= 1');
  }
  if (!VALID_ALGORITHMS.has(algorithm)) {
    throw new WebContractError('update algorithm is invalid');
  }
  if (algorithm === 'heatbath' && !heatbathSupportsLattice(latticeExtents)) {
    throw new WebContractError('heatbath requires every lattice extent to exceed one');
  }
  if (!VALID_CONDITIONS.has(input.condition)) {
    throw new WebContractError('initial configuration is invalid');
  }
  if (!VALID_PLANES.has(input.plane)) {
    throw new WebContractError('plane is invalid');
  }
  const slice = requireInteger(
    input.slice,
    'slice',
    1,
    planeSliceMaximum(latticeExtents, input.plane),
  );

  return Object.freeze({
    gaugeGroup,
    latticeExtents: Object.freeze(latticeExtents),
    beta,
    sweeps,
    seed,
    epsilon,
    algorithm,
    condition: input.condition,
    plane: input.plane,
    slice,
  });
}

export function planeSliceMaximum(latticeExtents, plane) {
  if (!Array.isArray(latticeExtents) || latticeExtents.length !== 4 || !VALID_PLANES.has(plane)) {
    throw new WebContractError('cannot determine slice bounds');
  }
  const fixedAxes = 'xyzt'.split('').filter(axis => !plane.includes(axis));
  return Math.min(...fixedAxes.map(axis => latticeExtents[AXIS_INDEX[axis]]));
}

function juliaFloat(value) {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

function gaugeColorCount(gaugeGroup) {
  return gaugeGroup === 'SU2' ? 2 : 3;
}

export function webConfigurationStateLength(gaugeGroup, latticeExtents) {
  if (!VALID_GAUGE_GROUPS.has(gaugeGroup)
      || !Array.isArray(latticeExtents)
      || latticeExtents.length !== 4) {
    throw new WebContractError('cannot determine configuration state length');
  }
  const volume = latticeExtents.reduce(
    (product, extent, index) => product * requireInteger(
      extent,
      `lattice extent ${'xyzt'[index]}`,
      1,
      8,
    ),
    1,
  );
  if (gaugeGroup === 'SU2' && latticeExtents.every(extent => extent > 1)) {
    return 16 * volume;
  }
  const nc = gaugeColorCount(gaugeGroup);
  return 2 * 4 * nc * nc * volume;
}

export function buildWebSessionStartDriver(input, chunkSweeps) {
  const parameters = validateSimulationParameters(input);
  if (parameters.gaugeGroup !== 'SU2'
      || !parameters.latticeExtents.every(extent => extent > 1)) {
    throw new WebContractError('persistent session driver requires a nondegenerate SU(2) lattice');
  }
  const sweeps = requireInteger(chunkSweeps, 'chunk sweeps', 0, parameters.sweeps);
  const [nx, ny, nz, nt] = parameters.latticeExtents;
  return [
    'gfl_web_session = start_fast_su2_web_session(',
    `    ${nx}, ${ny}, ${nz}, ${nt},`,
    `    ${juliaFloat(parameters.beta)},`,
    `    ${parameters.seed};`,
    `    epsilon=${juliaFloat(parameters.epsilon)},`,
    `    algorithm=${JSON.stringify(parameters.algorithm)},`,
    `    condition=${JSON.stringify(parameters.condition)},`,
    `    plane=${JSON.stringify(parameters.plane)},`,
    `    slice=(${parameters.slice}, ${parameters.slice}),`,
    '    low_precision=false,',
    ')',
    `run_fast_web_session_chunk!(gfl_web_session, ${sweeps})`,
  ].join('\n');
}

export function buildWebSessionChunkDriver(chunkSweeps, input = undefined) {
  const sweeps = requireInteger(chunkSweeps, 'chunk sweeps', 0, 1000);
  if (input !== undefined) {
    const parameters = validateSimulationParameters(input);
    if (parameters.gaugeGroup !== 'SU2'
        || !parameters.latticeExtents.every(extent => extent > 1)) {
      throw new WebContractError('persistent session driver requires a nondegenerate SU(2) lattice');
    }
    return [
      'gfl_web_session = reconfigure_fast_su2_web_session(',
      '    gfl_web_session,',
      `    ${JSON.stringify(parameters.plane)},`,
      `    (${parameters.slice}, ${parameters.slice}),`,
      ')',
      `run_fast_web_session_chunk!(gfl_web_session, ${sweeps})`,
    ].join('\n');
  }
  return `run_fast_web_session_chunk!(gfl_web_session, ${sweeps})`;
}

export function buildWebSu3SessionStartDriver(input, chunkSweeps) {
  const parameters = validateSimulationParameters(input);
  if (parameters.gaugeGroup !== 'SU3') {
    throw new WebContractError('persistent SU(3) session driver requires SU(3)');
  }
  const sweeps = requireInteger(chunkSweeps, 'chunk sweeps', 0, parameters.sweeps);
  const [nx, ny, nz, nt] = parameters.latticeExtents;
  return [
    'gfl_web_su3_session = start_fast_su3_web_session(',
    `    ${nx}, ${ny}, ${nz}, ${nt},`,
    `    ${juliaFloat(parameters.beta)},`,
    `    ${parameters.seed};`,
    `    epsilon=${juliaFloat(parameters.epsilon)},`,
    `    algorithm=${JSON.stringify(parameters.algorithm)},`,
    `    condition=${JSON.stringify(parameters.condition)},`,
    `    plane=${JSON.stringify(parameters.plane)},`,
    `    slice=(${parameters.slice}, ${parameters.slice}),`,
    ')',
    `run_fast_su3_web_session_chunk!(gfl_web_su3_session, ${sweeps})`,
  ].join('\n');
}

export function buildWebSu3SessionChunkDriver(chunkSweeps, input = undefined) {
  const sweeps = requireInteger(chunkSweeps, 'chunk sweeps', 0, 1000);
  if (input !== undefined) {
    const parameters = validateSimulationParameters(input);
    if (parameters.gaugeGroup !== 'SU3') {
      throw new WebContractError('persistent SU(3) session driver requires SU(3)');
    }
    return [
      'gfl_web_su3_session = reconfigure_fast_su3_web_session(',
      '    gfl_web_su3_session,',
      `    ${JSON.stringify(parameters.plane)},`,
      `    (${parameters.slice}, ${parameters.slice}),`,
      ')',
      `run_fast_su3_web_session_chunk!(gfl_web_su3_session, ${sweeps})`,
    ].join('\n');
  }
  return `run_fast_su3_web_session_chunk!(gfl_web_su3_session, ${sweeps})`;
}

export function buildSimulationChunkDriver(input, chunkState) {
  const parameters = validateSimulationParameters(input);
  const chunkSweeps = requireInteger(chunkState.chunkSweeps, 'chunk sweeps', 0, parameters.sweeps);
  const completedSweeps = requireInteger(
    chunkState.completedSweeps,
    'completed sweeps',
    0,
    parameters.sweeps,
  );
  if (completedSweeps + chunkSweeps > parameters.sweeps) {
    throw new WebContractError('chunk exceeds requested total sweeps');
  }
  const rngState = requireInteger(chunkState.rngState, 'RNG state', 0, MAX_SAFE_SEED);
  if (!Array.isArray(chunkState.configuration)) {
    throw new WebContractError('configuration state must be an array');
  }
  const expectedStateLength = webConfigurationStateLength(
    parameters.gaugeGroup,
    parameters.latticeExtents,
  );
  const firstChunk = chunkState.configuration.length === 0;
  if (firstChunk ? completedSweeps !== 0 : chunkState.configuration.length !== expectedStateLength) {
    throw new WebContractError('configuration state does not match chunk metadata');
  }
  const configuration = chunkState.configuration.map((value, index) =>
    requireFiniteNumber(value, `configuration value ${index}`));
  const [nx, ny, nz, nt] = parameters.latticeExtents;
  const nc = gaugeColorCount(parameters.gaugeGroup);
  const configurationLiteral = `Float64[${configuration.map(juliaFloat).join(',')}]`;
  return [
    'web_chunk_result = run_simulation_chunk_web(',
    `    ${nc}, ${nx}, ${ny}, ${nz}, ${nt},`,
    `    ${juliaFloat(parameters.beta)},`,
    `    ${chunkSweeps},`,
    `    ${rngState},`,
    `    ${completedSweeps},`,
    `    ${configurationLiteral};`,
    `    epsilon=${juliaFloat(parameters.epsilon)},`,
    `    condition=${JSON.stringify(parameters.condition)},`,
    `    plane=${JSON.stringify(parameters.plane)},`,
    `    slice=(${parameters.slice}, ${parameters.slice}),`,
    ')',
    'web_chunk_result',
  ].join('\n');
}

export function buildSimulationDriver(input) {
  const parameters = validateSimulationParameters(input);
  const [nx, ny, nz, nt] = parameters.latticeExtents;
  return [
    'web_result = run_simulation_web(',
    `    ${nx}, ${ny}, ${nz}, ${nt},`,
    `    ${juliaFloat(parameters.beta)},`,
    `    ${parameters.sweeps},`,
    `    ${parameters.seed};`,
    `    epsilon=${juliaFloat(parameters.epsilon)},`,
    `    condition=${JSON.stringify(parameters.condition)},`,
    `    plane=${JSON.stringify(parameters.plane)},`,
    `    slice=(${parameters.slice}, ${parameters.slice}),`,
    ')',
    'web_result',
  ].join('\n');
}

function mapOrObjectValue(value, key) {
  if (value instanceof Map) return value.get(key);
  return value?.[key];
}

export function extractTypedNumericValues(typedValue) {
  let elements;
  if (Array.isArray(typedValue) || ArrayBuffer.isView(typedValue)) {
    elements = Array.from(typedValue);
  } else {
    elements = mapOrObjectValue(typedValue, 'elements');
  }
  if (!Array.isArray(elements) && !ArrayBuffer.isView(elements)) {
    throw new WebContractError('typed result does not contain a numeric array');
  }

  return Array.from(elements, element => {
    const value = typeof element === 'number' ? element : mapOrObjectValue(element, 'value');
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new WebContractError('typed result contains a non-finite numeric value');
    }
    return value;
  });
}

function requireResultInteger(value, name, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new WebContractError(`${name} must be a nonnegative integer`);
  }
  return value;
}

export function decodeWebResult(input, expectedSweeps = undefined) {
  const values = Array.from(input);
  if (values.length < WEB_RESULT_HEADER_LENGTH) {
    throw new WebContractError('result is shorter than the schema header');
  }
  if (!values.every(value => typeof value === 'number' && Number.isFinite(value))) {
    throw new WebContractError('result contains a non-finite value');
  }
  if (values[0] !== WEB_RESULT_SCHEMA_VERSION) {
    throw new WebContractError(`unsupported result schema: ${values[0]}`);
  }

  const sweeps = requireResultInteger(values[1], 'sweeps');
  const accepted = requireResultInteger(values[6], 'accepted count');
  const offered = requireResultInteger(values[7], 'offered count');
  const sliceWidth = requireResultInteger(values[8], 'slice width', 1);
  const sliceHeight = requireResultInteger(values[9], 'slice height', 1);
  const frameCount = requireResultInteger(values[10], 'slice frame count', 1);
  if (expectedSweeps !== undefined && sweeps !== expectedSweeps) {
    throw new WebContractError('result sweep count does not match the request');
  }
  if (accepted > offered) {
    throw new WebContractError('accepted count exceeds offered count');
  }
  if (frameCount > sweeps + 1) {
    throw new WebContractError('slice frame count exceeds the available sweep range');
  }
  const overallAcceptance = values[5];
  if (overallAcceptance < 0 || overallAcceptance > 1) {
    throw new WebContractError('overall acceptance is outside [0, 1]');
  }

  const frameSize = sliceWidth * sliceHeight;
  const expectedLength = WEB_RESULT_HEADER_LENGTH + 4 * sweeps + frameCount * frameSize;
  if (values.length !== expectedLength) {
    throw new WebContractError(
      `result length ${values.length} does not match schema length ${expectedLength}`,
    );
  }

  let cursor = WEB_RESULT_HEADER_LENGTH;
  const take = length => {
    const block = values.slice(cursor, cursor + length);
    cursor += length;
    return block;
  };
  const plaquetteHistory = take(sweeps);
  const polyakovRealHistory = take(sweeps);
  const polyakovImagHistory = take(sweeps);
  const acceptanceHistory = take(sweeps);
  const sliceFrameValues = take(frameCount * frameSize);
  const sliceFrames = Array.from({ length: frameCount }, (_, frameIndex) => {
    const offset = frameIndex * frameSize;
    return sliceFrameValues.slice(offset, offset + frameSize);
  });
  const sliceValues = sliceFrames.at(-1);

  if (acceptanceHistory.some(value => value < 0 || value > 1)) {
    throw new WebContractError('acceptance history contains a value outside [0, 1]');
  }

  return Object.freeze({
    schemaVersion: values[0],
    sweeps,
    finalPlaquette: values[2],
    finalPolyakovReal: values[3],
    finalPolyakovImag: values[4],
    finalPolyakovMagnitude: Math.hypot(values[3], values[4]),
    overallAcceptance,
    accepted,
    offered,
    sliceWidth,
    sliceHeight,
    frameCount,
    frameStartSweep: sweeps - frameCount + 1,
    plaquetteHistory,
    polyakovRealHistory,
    polyakovImagHistory,
    acceptanceHistory,
    sliceFrames,
    sliceValues,
  });
}

export function decodeWebChunkResult(input, expectedParameters = undefined) {
  const values = Array.from(input);
  if (values.length < WEB_CHUNK_HEADER_LENGTH
      || !values.every(value => typeof value === 'number' && Number.isFinite(value))) {
    throw new WebContractError('chunk result is malformed');
  }
  const persistentSession = values[0] === WEB_SESSION_CHUNK_SCHEMA_VERSION;
  if (values[0] !== WEB_CHUNK_SCHEMA_VERSION && !persistentSession) {
    throw new WebContractError(`unsupported chunk schema: ${values[0]}`);
  }
  const nc = requireResultInteger(values[1], 'color count', 2);
  if (nc !== 2 && nc !== 3) throw new WebContractError('chunk color count is invalid');
  const latticeExtents = values.slice(2, 6).map((value, index) =>
    requireResultInteger(value, `chunk extent ${'xyzt'[index]}`, 1));
  const chunkSweeps = requireResultInteger(values[6], 'chunk sweeps');
  const completedSweeps = requireResultInteger(values[7], 'completed sweeps');
  const accepted = requireResultInteger(values[12], 'chunk accepted count');
  const offered = requireResultInteger(values[13], 'chunk offered count');
  const sliceWidth = requireResultInteger(values[14], 'chunk slice width', 1);
  const sliceHeight = requireResultInteger(values[15], 'chunk slice height', 1);
  const frameCount = requireResultInteger(values[16], 'chunk frame count', 1);
  const rngState = requireResultInteger(values[17], 'chunk RNG state', 1);
  const configurationLength = requireResultInteger(values[18], 'configuration length');
  if (accepted > offered || frameCount !== chunkSweeps + 1 || completedSweeps < chunkSweeps) {
    throw new WebContractError('chunk result metadata is inconsistent');
  }
  const overallAcceptance = values[11];
  if (overallAcceptance < 0 || overallAcceptance > 1) {
    throw new WebContractError('chunk acceptance is outside [0, 1]');
  }
  const frameSize = sliceWidth * sliceHeight;
  const expectedLength = WEB_CHUNK_HEADER_LENGTH
    + 4 * chunkSweeps
    + frameCount * frameSize
    + configurationLength;
  if (values.length !== expectedLength) {
    throw new WebContractError('chunk result length is inconsistent');
  }

  const gaugeGroup = nc === 2 ? 'SU2' : 'SU3';
  if ((!persistentSession
      && configurationLength !== webConfigurationStateLength(gaugeGroup, latticeExtents))
      || (persistentSession && configurationLength !== 0)) {
    throw new WebContractError('chunk configuration length is inconsistent');
  }
  if (expectedParameters !== undefined) {
    const parameters = validateSimulationParameters(expectedParameters);
    if (parameters.gaugeGroup !== gaugeGroup
        || parameters.latticeExtents.some((extent, index) => extent !== latticeExtents[index])
        || completedSweeps > parameters.sweeps) {
      throw new WebContractError('chunk result does not match the request');
    }
  }

  let cursor = WEB_CHUNK_HEADER_LENGTH;
  const take = length => {
    const block = values.slice(cursor, cursor + length);
    cursor += length;
    return block;
  };
  const plaquetteHistory = take(chunkSweeps);
  const polyakovRealHistory = take(chunkSweeps);
  const polyakovImagHistory = take(chunkSweeps);
  const acceptanceHistory = take(chunkSweeps);
  const sliceFrameValues = take(frameCount * frameSize);
  const sliceFrames = Array.from({ length: frameCount }, (_, frameIndex) => {
    const offset = frameIndex * frameSize;
    return sliceFrameValues.slice(offset, offset + frameSize);
  });
  const configuration = take(configurationLength);
  return Object.freeze({
    schemaVersion: values[0],
    gaugeGroup,
    latticeExtents: Object.freeze(latticeExtents),
    chunkSweeps,
    completedSweeps,
    finalPlaquette: values[8],
    finalPolyakovReal: values[9],
    finalPolyakovImag: values[10],
    overallAcceptance,
    accepted,
    offered,
    sliceWidth,
    sliceHeight,
    frameCount,
    rngState,
    plaquetteHistory,
    polyakovRealHistory,
    polyakovImagHistory,
    acceptanceHistory,
    sliceFrames,
    configuration,
  });
}

export function chooseAdaptiveChunkSize({
  currentChunk,
  elapsedMs,
  remainingSweeps,
  targetMs = 1500,
  minimum = 1,
  maximum = 32,
}) {
  requireInteger(currentChunk, 'current chunk', 1, 1000);
  requireFiniteNumber(elapsedMs, 'chunk elapsed time');
  requireInteger(remainingSweeps, 'remaining sweeps', 0, 1000);
  requireFiniteNumber(targetMs, 'target chunk time');
  requireInteger(minimum, 'minimum chunk size', 1, 1000);
  requireInteger(maximum, 'maximum chunk size', minimum, 1000);
  if (elapsedMs <= 0 || targetMs <= 0) throw new WebContractError('chunk timing must be positive');
  if (remainingSweeps === 0) return 0;
  const estimate = Math.max(1, Math.round(currentChunk * targetMs / elapsedMs));
  const lowerGrowthBound = Math.max(minimum, Math.ceil(currentChunk / 2));
  const upperGrowthBound = Math.min(maximum, currentChunk * 2);
  return Math.min(
    remainingSweeps,
    Math.max(lowerGrowthBound, Math.min(upperGrowthBound, estimate)),
  );
}
