---
title: Machine Learning
description: The big picture of ML, from learning paradigms to neural networks and a typical project workflow.
tags: [ml, deep-learning, guide]
markmap:
  theme: studio
  initialExpandLevel: 2
---

# Machine Learning

## Supervised learning
- Learn $f(x) \to y$ from labelled examples
- **Regression**: predict a number
  - Linear regression, gradient boosting
- **Classification**: predict a class
  - Logistic regression, random forests, SVMs
- Loss examples: MSE, cross-entropy

## Unsupervised learning
- Find structure without labels
- **Clustering**: k-means, DBSCAN, GMMs
- **Dimensionality reduction**: PCA, UMAP, t-SNE
- **Density estimation** and anomaly detection

## Reinforcement learning
- An agent acts, the environment rewards
- Goal: maximize expected return $\sum_t \gamma^t r_t$
- Value-based: Q-learning, DQN
- Policy-based: REINFORCE, PPO
- Explore vs exploit

## Neural networks
- A **neuron**: weighted sum → *activation*
- Activations
  - ReLU
  - Sigmoid
  - Tanh
  - Softmax
- Layers
  - Dense (fully connected)
  - Convolutional
  - Recurrent
  - Attention
- ![A 3-2-1 network](maps/img/nn-3-2-1.svg)<br>Architecture: a 3 → 2 → 1 net
- Training loop
  - Forward pass
  - Compute the loss
  - Backpropagate gradients
  - Optimizer step (SGD, Adam)

## Typical workflow
- Frame the problem and the metric
- Collect and clean data
- Split: train / validation / test
- Baseline first, then iterate
- Evaluate, error analysis
- Deploy and monitor drift

## Learning checklist
- [x] Python
- [x] NumPy & Pandas
- [x] scikit-learn
- [ ] PyTorch / TensorFlow
- [ ] Ship one end-to-end project
