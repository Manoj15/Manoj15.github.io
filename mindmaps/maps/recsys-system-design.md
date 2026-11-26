---
title: Recommender System Design
description: End-to-end blueprint for an ML system design interview on recommendations.
tags: [recsys, system-design, ml]
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 2
  maxWidth: 300
---

# Recommender System Design

## Requirements
### Product
- Surface: home feed, related items, notifications, search
- Objective: clicks, watch time, purchases, long-term retention
### Scale
- Users, items, QPS, latency budget (often < 200 ms)
- Item churn: news (hours) vs movies (years)
### Constraints
- Freshness, diversity, fairness, policy filters

## Data
- **Implicit** feedback: clicks, dwell, add-to-cart, skips
- **Explicit** feedback: ratings, likes, hides
- User features: history, demographics, context (time, device)
- Item features: content, embeddings, popularity, age
- Labels and position bias
  - Log impressions, not just clicks
  - Inverse propensity weighting

## Architecture
### 1. Candidate generation
- Goal: millions → ~1,000, high recall
- **Two-tower** model, ANN search (FAISS, ScaNN, HNSW)
- Item-to-item co-visitation
- Popular / trending / fresh sources
- Graph walks (PinSage-style GNN)
### 2. Ranking
- Goal: ~1,000 → ~100, high precision
- GBDT → DNN → Wide & Deep, DCN, DLRM
- Multi-task heads: pCTR, pWatch, pLike
  - MMoE / PLE for task conflicts
- Score = weighted combination of heads
### 3. Re-ranking
- Diversity: MMR, DPP
- Business rules, dedupe, freshness boosts
- Exploration: epsilon-greedy, Thompson sampling

## Training
- Negative sampling
  - In-batch negatives, with logQ correction
  - Hard negatives from retrieval
- Loss: BCE for pointwise, BPR / softmax for retrieval
- Incremental / streaming updates for freshness
- Feature store keeps training and serving consistent

## Serving
- Precompute item embeddings, index offline
- User tower online, ANN lookup, then ranker
- Caching, feature fetch fan-out, timeouts with fallbacks
- Cold start
  - New users: popular + onboarding signals
  - New items: content embeddings, exploration budget

## Evaluation
### Offline
- Recall@K, NDCG@K, MAP, AUC
- Time-based splits, never random splits
### Online
- A/B test on the product objective
- Guardrails: latency, diversity, complaints
- Interleaving for fast ranker comparisons

## Pitfalls
- Feedback loops and popularity bias
- Train / serve skew
- Optimizing clicks hurts satisfaction (clickbait)
- Delayed labels (conversions)
