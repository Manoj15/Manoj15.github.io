---
title: Transformers
description: Core architecture, attention math, variants and efficiency tricks for NLP and RecSys interviews.
tags: [deep-learning, nlp, ml]
markmap:
  theme: midnight
  colorFreezeLevel: 2
  initialExpandLevel: 2
  maxWidth: 320
---

# Transformers

## Attention
### Scaled dot-product
- $\text{Attention}(Q,K,V) = \text{softmax}\left(\frac{QK^\top}{\sqrt{d_k}}\right)V$
- $\sqrt{d_k}$ keeps logits from saturating the softmax
- Cost $O(n^2 d)$ in sequence length $n$
### Multi-head
- $h$ heads with $d_k = d_{model}/h$
- Each head learns a different relation
- Concatenate, then project with $W^O$
### Masks
- Padding mask
- Causal mask for decoders

## Block anatomy
- Token embedding + positional information
- Attention → Add & LayerNorm
- Feed-forward: $d_{ff} \approx 4 d_{model}$, GELU / SwiGLU
- Pre-LN (modern) vs Post-LN (original)
- Residual stream carries information between layers

## Positional encoding
- Sinusoidal (original)
- Learned absolute
- Relative: T5 bias, ALiBi
- **RoPE**: rotate Q and K by position, good length extrapolation

## Families
### Encoder-only
- BERT: masked LM + NSP
- Use: classification, embeddings, retrieval
### Decoder-only
- GPT: next-token prediction
- Use: generation, in-context learning
### Encoder-decoder
- T5, BART
- Use: translation, summarization

## Efficiency
- **KV cache** for fast autoregressive decoding
- Multi-query / grouped-query attention shrink the KV cache
- FlashAttention: IO-aware exact attention
- Sparse / linear attention for long sequences
- Mixture of Experts: more parameters, same compute per token
- Quantization: int8, int4; LoRA for cheap fine-tuning

## Training
- AdamW, warmup + cosine decay
- Mixed precision (bf16), gradient clipping
- Data / tensor / pipeline parallelism, FSDP
- Fine-tuning: SFT → RLHF / DPO

## In recommender systems
- **SASRec**: causal self-attention over the item history
- **BERT4Rec**: masked item prediction
- Transformers as the user tower in two-tower retrieval
- Feature interaction: AutoInt, attention over feature fields
- Generative retrieval with semantic item IDs

## Interview questions
- Why divide by $\sqrt{d_k}$?
- Why LayerNorm and not BatchNorm?
- How does the KV cache change decode complexity?
- Encoder vs decoder: when to use which?
- How would you handle sequences of 100k tokens?
