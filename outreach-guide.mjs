export const GUIDED_EXPERIMENT = Object.freeze({
  gaugeGroup: 'SU2',
  latticeExtents: '4,4,4,4',
  beta: '2.3',
  condition: 'cold',
  algorithm: 'heatbath',
  sweeps: '100',
  seed: '123',
  visualization: 'landscape',
  plane: 'xy',
  slice: '1',
});

export function guidedNarration({ sweep = 0, totalSweeps = 0, completed = false } = {}) {
  if (completed) {
    return {
      stepKey: 'guided.exploreStep',
      titleKey: 'guided.exploreTitle',
      detailKey: 'guided.exploreDetail',
    };
  }

  if (sweep <= 0) {
    return {
      stepKey: 'guided.observeStep',
      titleKey: 'guided.coldTitle',
      detailKey: 'guided.coldDetail',
    };
  }

  const fraction = totalSweeps > 0 ? sweep / totalSweeps : 0;
  if (fraction < 0.25) {
    return {
      stepKey: 'guided.observeStep',
      titleKey: 'guided.fluctuationTitle',
      detailKey: 'guided.fluctuationDetail',
    };
  }

  return {
    stepKey: 'guided.observeStep',
    titleKey: 'guided.forgettingTitle',
    detailKey: 'guided.forgettingDetail',
  };
}
