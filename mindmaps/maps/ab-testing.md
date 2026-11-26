---
title: A/B Testing
description: Design, analysis and pitfalls of online controlled experiments, as asked in product DS interviews.
tags: [statistics, experimentation, product-ds]
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 2
  maxWidth: 320
---

# A/B Testing

## 1. Frame the problem
- Clarify the **goal** and the user flow being changed
- Hypothesis: change X moves metric Y for population Z
- Is an experiment even possible?
  - Network effects, legal limits, tiny traffic → consider quasi-experiments

## 2. Metrics
### Primary (OEC)
- One decision metric tied to long-term value
- Sensitive *and* hard to game
### Secondary
- Explain *why* the primary moved
- Funnel steps, engagement depth
### Guardrails
- Latency, crash rate, revenue, unsubscribes
- Must not degrade beyond a set threshold
### Sanity / invariant
- Sample ratio, page load counts in pre-period

## 3. Design
### Randomization unit
- User (most common), session, page view, cluster
- Analysis unit ≠ randomization unit → use delta method or bootstrap
### Sample size
- $n \approx \frac{2(z_{1-\alpha/2} + z_{1-\beta})^2 \sigma^2}{\delta^2}$ per arm
- Inputs: baseline, MDE, $\alpha = 0.05$, power 80%
- Rule of thumb: $n \approx 16\sigma^2 / \delta^2$
### Duration
- Cover full weekly cycles (≥ 1–2 weeks)
- Watch novelty and primacy effects
### Allocation
- 50/50 maximizes power
- Ramp: 1% → 5% → 50% for risky launches

## 4. Run & monitor
- **Sample Ratio Mismatch**: chi-square test on arm counts
- A/A tests validate the pipeline
- Do not stop the moment p < 0.05 (peeking)
  - Use sequential tests or alpha spending if you must look

## 5. Analyze
### Tests
- Proportions: two-proportion z-test
- Means: Welch's t-test
- Ratio metrics: delta method
- Heavy tails: bootstrap, winsorize, Mann-Whitney
### Variance reduction
- **CUPED**: $Y' = Y - \theta(X - \bar{X})$, $\theta = \frac{cov(X,Y)}{var(X)}$
- Stratification, post-stratification
### Read the result
- Effect size + confidence interval, not only p-value
- Practical vs statistical significance
- Segment cuts are hypotheses, not conclusions

## 6. Pitfalls
- **Multiple testing**: Bonferroni, Benjamini-Hochberg
- **Interference / network effects**
  - Cluster or switchback randomization
  - Two-sided marketplaces: budget-split designs
- **Simpson's paradox** across segments
- **Novelty effect**: look at the trend over days
- Twyman's law: surprising = probably a bug

## 7. Decide
- Launch, iterate or kill
- Trade-offs between metrics written down beforehand
- Holdouts to measure long-term impact
