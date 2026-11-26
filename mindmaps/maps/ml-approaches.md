---
title: Machine Learning Approaches
description: Research-level map of ML paradigms, objective families and methods, showing where contrastive learning fits (coverage through mid-2026).
tags: [machine-learning, self-supervised, contrastive-learning, reinforcement-learning, research]
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 2
  maxWidth: 320
---

# Machine Learning Approaches

## Supervised learning
### Classification and regression
- Signal: a label or value per input
- Asks: *"What is the target for this input?"*
- [XGBoost](https://arxiv.org/abs/1603.02754), logistic regression, deep nets
### Probabilistic and quantile
- Signal: outcomes scored by proper rules or pinball loss
- Asks: *"What is the outcome's distribution?"*
- GLMs, quantile regression, [conformal](https://arxiv.org/abs/2107.07511)
### Structured prediction
- Signal: a whole sequence, tag set or tree
- Asks: *"Which joint output is most consistent?"*
- CRF, [encoder-decoder](https://arxiv.org/abs/1706.03762), instruction SFT
### Learning to rank
- Signal: graded or pairwise relevance
- Asks: *"Which item should rank above which?"*
- RankNet, LambdaMART, ListNet
### Supervised contrastive
- Signal: labels decide which pairs are positives
- Asks: *"Which candidate shares this anchor's label?"*
- [SupCon](https://arxiv.org/abs/2004.11362), [triplet loss](https://arxiv.org/abs/1503.03832)
- ↔ same objective as **Contrastive learning**
### Knowledge distillation
- Signal: a teacher's soft predictions
- Asks: *"What would the teacher predict?"*
- [Soft-label KD](https://arxiv.org/abs/1503.02531), feature distillation

## Unsupervised learning
### Clustering
- Signal: similarity or density among points
- Asks: *"Which points belong together?"*
- k-means, GMM via EM, HDBSCAN, [DEC](https://arxiv.org/abs/1511.06335)
### Dimensionality reduction
- Signal: variance, reconstruction, neighborhoods
- Asks: *"Which few coordinates preserve structure?"*
- PCA, NMF, [UMAP](https://arxiv.org/abs/1802.03426), autoencoders
### Generative modeling
- Signal: the data distribution $p(x)$
- Asks: *"How likely is $x$, and how do I sample one?"*
- [VAE](https://arxiv.org/abs/1312.6114), [GAN](https://arxiv.org/abs/1406.2661), [flows](https://arxiv.org/abs/1912.02762)
- [Diffusion](https://arxiv.org/abs/2006.11239), [flow matching](https://arxiv.org/abs/2210.02747)
- ↔ spans settings: $p(x \mid c)$ is supervised, next-token is self-supervised
### Latent factor models
- Signal: co-occurrence or interaction matrix
- Asks: *"Which hidden factors explain co-occurrence?"*
- Matrix factorization, LDA
### Anomaly detection
- Signal: what normal data looks like
- Asks: *"Does this point fit the normal pattern?"*
- Isolation forest, one-class SVM, reconstruction error

## Self-supervised learning
### Contrastive learning
- Signal: positive pair vs. in-batch or queued negatives
- Asks: ==*"Which candidate matches this anchor?"*==
- InfoNCE: $-\log \frac{e^{s(x,x^+)/\tau}}{\sum_j e^{s(x,x_j)/\tau}}$
- [SimCLR](https://arxiv.org/abs/2002.05709), [MoCo](https://arxiv.org/abs/1911.05722), [CPC](https://arxiv.org/abs/1807.03748), [SimCSE](https://arxiv.org/abs/2104.08821)
### Self-distillation (non-contrastive)
- Signal: teacher embedding of another view, no negatives
- Asks: *"Can I predict the teacher's view embedding?"*
- [BYOL](https://arxiv.org/abs/2006.07733), [SimSiam](https://arxiv.org/abs/2011.10566), [DINO](https://arxiv.org/abs/2104.14294), [DINOv2](https://arxiv.org/abs/2304.07193)
### Redundancy reduction
- Signal: cross-view correlation statistics
- Asks: *"Invariant, yet every dimension informative?"*
- [Barlow Twins](https://arxiv.org/abs/2103.03230), [VICReg](https://arxiv.org/abs/2105.04906)
- Clustering cousin: [SwAV](https://arxiv.org/abs/2006.09882), [DeepCluster](https://arxiv.org/abs/1807.05520)
### Latent prediction (JEPA)
- Signal: target encoder's embedding of a masked region
- Asks: *"What is the embedding of the missing part?"*
- [I-JEPA](https://arxiv.org/abs/2301.08243), V-JEPA, [data2vec](https://arxiv.org/abs/2202.03555)
### Masked prediction
- Signal: hidden tokens or patches
- Asks: *"What belongs in the missing position?"*
- [BERT](https://arxiv.org/abs/1810.04805), [MAE](https://arxiv.org/abs/2111.06377), [BEiT](https://arxiv.org/abs/2106.08254)
### Autoregressive prediction
- Signal: the next element of a sequence
- Asks: *"What comes next?"*
- [GPT-style LMs](https://arxiv.org/abs/2005.14165)
- ↔ also a generative likelihood model

## Semi-supervised learning
### Self-training
- Signal: confident pseudo-labels
- Asks: *"Am I sure enough to train on my own label?"*
- Pseudo-labeling, [Noisy Student](https://arxiv.org/abs/1911.04252)
### Consistency regularization
- Signal: stability under perturbation
- Asks: *"Same prediction when the input changes?"*
- [Mean Teacher](https://arxiv.org/abs/1703.01780), [MixMatch](https://arxiv.org/abs/1905.02249), [FixMatch](https://arxiv.org/abs/2001.07685)
- ↔ same invariance idea as joint-embedding SSL
### Graph-based propagation
- Signal: labels spread over a similarity graph
- Asks: *"What label do the neighbors imply?"*
- Label propagation, [GCN](https://arxiv.org/abs/1609.02907)

## Weakly supervised learning
### Noisy labels (inaccurate)
- Signal: labels with unknown error rate
- Asks: *"Which labels can I trust?"*
- [Co-teaching](https://arxiv.org/abs/1804.06872), noise transition models
### Programmatic labeling
- Signal: votes from heuristics, KBs or LLMs
- Asks: *"What label do weak sources agree on?"*
- [Snorkel](https://arxiv.org/abs/1711.10160), distant supervision, LLM labelers
### Inexact labels
- Signal: bag, positive-only or set labels
- Asks: *"Which instance explains the bag label?"*
- [Attention MIL](https://arxiv.org/abs/1802.04712), [PU learning](https://arxiv.org/abs/1811.04820), partial labels
### Paired web data
- Signal: naturally co-occurring pairs
- Asks: *"Which caption goes with this image?"*
- [CLIP](https://arxiv.org/abs/2103.00020), [SigLIP](https://arxiv.org/abs/2303.15343)
- ↔ contrastive learning at web scale

## Interactive and feedback learning
### Reinforcement learning
- Signal: delayed reward over trajectories
- Asks: *"Which actions maximize long-run return?"*
- Value-based: Q-learning, [DQN](https://arxiv.org/abs/1312.5602)
- Policy gradient: [PPO](https://arxiv.org/abs/1707.06347), [SAC](https://arxiv.org/abs/1801.01290)
- Model-based: [MuZero](https://arxiv.org/abs/1911.08265), [Dreamer](https://arxiv.org/abs/1912.01603)
- Offline: [CQL](https://arxiv.org/abs/2006.04779), [IQL](https://arxiv.org/abs/2110.06169)
- Verifiable rewards: [GRPO](https://arxiv.org/abs/2402.03300)
### Bandit feedback
- Signal: reward of the chosen arm only
- Asks: *"Which arm pays best; is exploring worth it?"*
- UCB, [Thompson sampling](https://arxiv.org/abs/1707.02038), [LinUCB](https://arxiv.org/abs/1003.0146)
- Logged feedback: IPS, [doubly robust](https://arxiv.org/abs/1103.4601), [CRM](https://arxiv.org/abs/1502.02362)
### Learning from demonstrations
- Signal: expert actions or trajectories
- Asks: *"What would the expert do here?"*
- Behavior cloning, [DAgger](https://arxiv.org/abs/1011.0686), [GAIL](https://arxiv.org/abs/1606.03476)
- Inverse RL: *"What reward explains the expert?"*
### Learning from preferences
- Signal: comparisons, A better than B
- Asks: *"Which output is better?"*
- Reward model: $P(A \succ B) = \sigma(r_A - r_B)$ → [RLHF](https://arxiv.org/abs/2203.02155)
- Direct: [DPO](https://arxiv.org/abs/2305.18290), [IPO](https://arxiv.org/abs/2310.12036), [KTO](https://arxiv.org/abs/2402.01306)
- AI feedback: [Constitutional AI](https://arxiv.org/abs/2212.08073)

## Cross-cutting approaches
### Reusing knowledge
- **Transfer**: can a source task help here? Fine-tuning, [LoRA](https://arxiv.org/abs/2106.09685)
- **Multitask**: can tasks share a representation? MMoE
- **Meta**: learn to adapt from few examples? [MAML](https://arxiv.org/abs/1703.03400)
### How data arrives
- **Active**: which point to label next? BALD, core-set
- **Online**: update per example with bounded regret? FTRL
- **Continual**: learn new tasks without forgetting? [EWC](https://arxiv.org/abs/1612.00796)
- **Federated**: learn where data can't move? [FedAvg](https://arxiv.org/abs/1602.05629)
### Uncertainty and effects
- **Bayesian**: what is the posterior? GPs, VI, deep ensembles
- **Causal**: what happens under intervention? [Double ML](https://arxiv.org/abs/1608.00060), causal forests
### Robustness
- **Robust**: holds under shift or attack? [Group DRO](https://arxiv.org/abs/1911.08731), [IRM](https://arxiv.org/abs/1907.02893)
- Conformal coverage, test-time adaptation

## Model classes and algorithms
### Four axes (keep separate)
- **Setting**: where the signal comes from
- **Objective**: what the loss rewards
- **Architecture**: the function class
- **Algorithm**: how it is optimized
### Classical statistical
- Linear models and GLMs
- Kernel methods: SVM, Gaussian processes
- Trees and ensembles: random forest, GBDT
- Graphical models: HMM, Bayes nets
- ⚡ [Trees still beat deep nets on most tabular data](https://arxiv.org/abs/2207.08815)
### Deep architectures
- MLP, CNN ([ResNet](https://arxiv.org/abs/1512.03385)), ViT
- [Transformer](https://arxiv.org/abs/1706.03762)
- [GNN](https://arxiv.org/abs/1901.00596), state-space ([Mamba](https://arxiv.org/abs/2312.00752))
- Two-tower encoders, usually trained contrastively
### Learning algorithms
- SGD/Adam with backprop
- EM, boosting
- MCMC, variational inference
- TD learning, policy gradient

## Where contrastive learning fits
### It is an objective, not a paradigm
- Augmented views → self-supervised (SimCLR, MoCo)
- Shared labels → supervised (SupCon)
- Web pairs → weakly supervised (CLIP)
- Co-occurrence and graphs → word2vec, GraphCL
### Closest alternatives
- No negatives: self-distillation, redundancy reduction
- Prototypes: clustering-based SSL
- Predict embeddings: JEPA
- Reconstruct inputs: masked prediction
### Theory links
- InfoNCE lower-bounds mutual information
- [Alignment and uniformity](https://arxiv.org/abs/2005.10242)
- [Spectral view](https://arxiv.org/abs/2205.11508) unifies contrastive and non-contrastive
- InfoNCE ≈ listwise softmax in learning to rank
### Open questions
- False negatives in the batch
- Dependence on hand-designed augmentations
- Batch-size sensitivity (sigmoid loss and queues reduce it)
