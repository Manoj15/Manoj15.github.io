---
title: Machine Learning Approaches
description: An applied scientist's map of ML, from learning signals to the retrieval, ranking, LLM, causal and production methods big-tech teams use (coverage through 2026).
tags: [machine-learning, recsys, llm, causal-inference, contrastive-learning, applied-science]
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 2
  maxWidth: 320
---

# ML for Applied Scientists

## Learning signals
### Supervised
- *"What is the target for this input?"*
- ERM: GBDT, deep nets, [Wide & Deep](https://arxiv.org/abs/1606.07792)
- Learning to rank: pointwise, pairwise, listwise (LambdaMART)
- [Distillation](https://arxiv.org/abs/1503.02531): a teacher's soft labels
### Self-supervised
- *"What does the data say about itself?"*
- Contrastive: *"which candidate matches this anchor?"*
- Masked: *"what belongs in the gap?"* ([BERT](https://arxiv.org/abs/1810.04805), [MAE](https://arxiv.org/abs/2111.06377))
- Next-token: *"what comes next?"* (LLMs, generative recsys)
- Latent prediction: [JEPA](https://arxiv.org/abs/2301.08243)
### Semi and weak supervision
- *"How do I learn with few or noisy labels?"*
- Pseudo-labels, [FixMatch](https://arxiv.org/abs/2001.07685) consistency
- Programmatic labels: [Snorkel](https://arxiv.org/abs/1711.10160)
- **LLM-as-labeler**, then distill to a small model
### Interactive feedback
- *"What happens if I act?"*
- Bandits: one-step reward
- RL: delayed reward over trajectories
- Demonstrations: behavior cloning, inverse RL
- Preferences: reward models, [DPO](https://arxiv.org/abs/2305.18290)
### Generative modeling
- *"How do I sample a new x?"*
- Autoregressive, [diffusion](https://arxiv.org/abs/2006.11239), [flow matching](https://arxiv.org/abs/2210.02747)
- Spans settings: $p(x)$ unsupervised, $p(x \mid c)$ supervised

## Representations and embeddings
### Contrastive two-tower
- *"Which item matches this query or user?"*
- In-batch sampled softmax with **logQ correction**
- Mixed and hard negatives ([ANCE](https://arxiv.org/abs/2007.00808))
- Serves directly as dot-product retrieval
### Pretrained encoders
- Text: [SimCSE](https://arxiv.org/abs/2104.08821), LLM embedding models
- Vision: [DINOv2](https://arxiv.org/abs/2304.07193), [MAE](https://arxiv.org/abs/2111.06377)
- Multimodal: [CLIP](https://arxiv.org/abs/2103.00020), [SigLIP](https://arxiv.org/abs/2303.15343)
### User sequence models
- *"What does this history say about intent?"*
- [SASRec](https://arxiv.org/abs/1808.09781), [BERT4Rec](https://arxiv.org/abs/1904.06690)
- Target attention: [DIN](https://arxiv.org/abs/1706.06978)
- Lifelong sequences: [SIM](https://arxiv.org/abs/2006.05639)
### Graph embeddings
- *"What do neighbors in the graph imply?"*
- [node2vec](https://arxiv.org/abs/1607.00653), [PinSage](https://arxiv.org/abs/1806.01973)
- GNNs for social, item and fraud graphs
### Compact and discrete codes
- [Matryoshka embeddings](https://arxiv.org/abs/2205.13147): one vector, many sizes
- Product quantization for ANN memory
- **Semantic IDs**: RQ-VAE codes per item ([TIGER](https://arxiv.org/abs/2305.05065))

## Retrieval, ranking and recommendation
### Candidate generation
- *"Which thousand items are worth scoring?"*
- Two-tower + ANN: [ScaNN](https://arxiv.org/abs/1908.10396), [HNSW](https://arxiv.org/abs/1603.09320), [FAISS](https://arxiv.org/abs/1702.08734)
- Multi-source: embedding, graph, co-visitation, trending
### Ranking models
- *"How likely is each engagement?"*
- Feature crosses: [DCN-V2](https://arxiv.org/abs/2008.13535), [DLRM](https://arxiv.org/abs/1906.00091)
- Scaling laws for rankers: [Wukong](https://arxiv.org/abs/2403.02545)
### Multi-task and multi-objective
- *"How do I trade off click, watch, like, revenue?"*
- MMoE, PLE expert gating
- [ESMM](https://arxiv.org/abs/1804.07931): CVR over the full exposure space
- Value model: weighted sum of predicted actions
### Generative recommenders (2024–26 frontier)
- *"Can recommendation be next-token prediction?"*
- [HSTU](https://arxiv.org/abs/2402.17152): actions as tokens, trillion-scale
- [OneRec](https://arxiv.org/abs/2502.18965): retrieve and rank in one model, DPO-aligned
- [Netflix GR at 1B params](https://arxiv.org/abs/2605.23312), multi-token prediction
- Reasoning recsys: SIDs aligned with language ([OpenOneRec](https://arxiv.org/abs/2512.24762))
### Re-ranking and whole page
- *"Is the final slate good as a set?"*
- Diversity: DPP, MMR
- Slate and page optimization, business rules
- Position-bias-aware labels
### Ads specifics
- Calibrated pCTR and pCVR: they set auction prices
- Delayed conversion feedback models
- Auto-bidding and budget pacing as control

## Foundation models and LLMs
### Pretraining at scale
- *"How should compute split between data and params?"*
- Scaling laws: [Chinchilla](https://arxiv.org/abs/2203.15556)
- Sparse MoE: [Mixtral](https://arxiv.org/abs/2401.04088)
- [FlashAttention](https://arxiv.org/abs/2205.14135), long context
### Post-training
- SFT on demonstrations
- Preferences: reward model + PPO, or [DPO](https://arxiv.org/abs/2305.18290)
- **RLVR**: [GRPO](https://arxiv.org/abs/2402.03300), [DAPO](https://arxiv.org/abs/2503.14476), [R1 recipe](https://arxiv.org/abs/2501.12948)
- Distill reasoning into small models
### Inference efficiency
- *"How do I serve it within the latency budget?"*
- [Speculative decoding](https://arxiv.org/abs/2211.17192)
- Paged KV cache: [vLLM](https://arxiv.org/abs/2309.06180)
- Quantization: int8, fp8, [QLoRA](https://arxiv.org/abs/2305.14314)
- [Test-time compute scaling](https://arxiv.org/abs/2408.03314)
### RAG and search
- *"Which evidence should ground the answer?"*
- Dense: [DPR](https://arxiv.org/abs/2004.04906); late interaction: [ColBERT](https://arxiv.org/abs/2004.12832)
- Hybrid BM25 + dense, then cross-encoder rerank
### Agents and evaluation
- Tool use and planning: [ReAct](https://arxiv.org/abs/2210.03629)
- Agentic RL on verifiable tasks
- [LLM-as-judge](https://arxiv.org/abs/2306.05685) evals, red-teaming
### LLMs inside recsys
- LLM embeddings and features for cold start
- Rec as language: [P5](https://arxiv.org/abs/2203.13366)
- LLM-generated labels and explanations

## Decisions under feedback loops
### Bandits
- *"Explore or exploit for this context?"*
- [Thompson sampling](https://arxiv.org/abs/1707.02038), [LinUCB](https://arxiv.org/abs/1003.0146)
- Neural and slate bandits
### Off-policy evaluation and learning
- *"How would a new policy do on logged data?"*
- IPS, SNIPS, [doubly robust](https://arxiv.org/abs/1103.4601)
- [Top-K REINFORCE correction](https://arxiv.org/abs/1812.02353) (YouTube)
### RL for long-term value
- *"What maximizes retention, not the next click?"*
- [SlateQ](https://arxiv.org/abs/1905.12767)
- Offline RL: [CQL](https://arxiv.org/abs/2006.04779), [IQL](https://arxiv.org/abs/2110.06169)
### Feedback-loop bias
- *"Is the model learning my old policy?"*
- Position bias: [unbiased LTR](https://arxiv.org/abs/1608.04468)
- Popularity and exposure bias
### Cold start and exploration
- New-item boosting with uncertainty
- Content and LLM embeddings as priors
- Meta-learning for new users

## Causal inference and experimentation
### A/B testing at scale
- *"Did the change move the metric?"*
- Variance reduction: CUPED, ML-based CUPAC
- Always-valid inference: [mSPRT](https://arxiv.org/abs/1512.04922)
- Guardrails and SRM checks
### Interference and marketplaces
- *"Do units in the experiment affect each other?"*
- [Switchback designs](https://arxiv.org/abs/2009.00148)
- Cluster and budget-split randomization
### Heterogeneous effects and uplift
- *"Who benefits from the treatment?"*
- [Meta-learners](https://arxiv.org/abs/1706.03461): S, T, X, DR
- [Causal forests](https://arxiv.org/abs/1510.04342), [double ML](https://arxiv.org/abs/1608.00060)
- Uplift targeting for promotions and ads
### Quasi-experiments
- *"What if I couldn't randomize?"*
- Difference-in-differences, synthetic control
- Regression discontinuity, instrumental variables
### Long-term and ranking metrics
- Surrogate indices for long-term outcomes
- Long-running holdouts
- Interleaving for fast ranker comparisons

## Forecasting and anomaly detection
### Classical and probabilistic
- ETS, ARIMA, Prophet
- Quantile GBDT for demand intervals
### Deep forecasters
- [DeepAR](https://arxiv.org/abs/1704.04110), [TFT](https://arxiv.org/abs/1912.09363), [N-BEATS](https://arxiv.org/abs/1905.10437)
### Time-series foundation models
- *"Can one model forecast any series zero-shot?"*
- [TimesFM](https://arxiv.org/abs/2310.10688), [Chronos](https://arxiv.org/abs/2403.07815)
### Hierarchical reconciliation
- Coherent store → region → total forecasts
- MinT optimal reconciliation
### Anomaly and fraud
- Isolation forest, autoencoder error
- Graph fraud rings with GNNs
- Streaming detection with drift control

## Production ML systems
### Distributed training
- Data, tensor and pipeline parallelism
- [ZeRO](https://arxiv.org/abs/1910.02054) / FSDP sharding
- Sharded embedding tables for recsys
### Freshness and online learning
- Real-time training: [Monolith](https://arxiv.org/abs/2209.07663)
- Feature stores, training–serving skew checks
- Drift monitoring and retraining triggers
### Calibration and uncertainty
- Platt and isotonic calibration
- [Conformal prediction](https://arxiv.org/abs/2107.07511)
- [Deep ensembles](https://arxiv.org/abs/1612.01474)
### Privacy and federated learning
- [DP-SGD](https://arxiv.org/abs/1607.00133)
- [FedAvg](https://arxiv.org/abs/1602.05629), on-device models
### Robustness and responsible ML
- Group shift: [group DRO](https://arxiv.org/abs/1911.08731)
- Fairness constraints and audits
- Adversarial and abuse resistance
### Model efficiency
- Distillation, pruning, quantization
- Cascades: cheap model first, heavy model on top-K

## Where contrastive learning fits
### An objective, not a paradigm
- Augmented views → self-supervised ([SimCLR](https://arxiv.org/abs/2002.05709), [MoCo](https://arxiv.org/abs/1911.05722))
- Shared labels → supervised ([SupCon](https://arxiv.org/abs/2004.11362))
- Web pairs → weakly supervised (CLIP)
- Co-engagement → two-tower recsys
### In production
- Two-tower retrieval with sampled softmax
- Dense retrieval for search and RAG
- Image-text search and zero-shot tagging
### Closest alternatives
- No negatives: [BYOL](https://arxiv.org/abs/2006.07733), [DINO](https://arxiv.org/abs/2104.14294)
- Decorrelation: [VICReg](https://arxiv.org/abs/2105.04906), [Barlow Twins](https://arxiv.org/abs/2103.03230)
- Predict embeddings: JEPA; reconstruct inputs: MAE
- Generative retrieval with semantic IDs
### Theory and pitfalls
- [InfoNCE](https://arxiv.org/abs/1807.03748): $-\log \frac{e^{s(q,d^+)/\tau}}{\sum_j e^{s(q,d_j)/\tau}}$
- [Alignment and uniformity](https://arxiv.org/abs/2005.10242)
- False negatives, popularity bias in in-batch negatives
