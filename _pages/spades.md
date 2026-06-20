---
layout: page
title: spades ai
permalink: /spades/
description: A deep learning card game bot using Monte Carlo Tree Search and Neural Networks
nav: false
nav_order: 3
---

## Overview

**Spades AI** is a card game bot that plays the classic trick-taking game Spades at a competitive level. The project combines two powerful AI techniques popularized by DeepMind's AlphaGo and AlphaZero:

- **Monte Carlo Tree Search (MCTS)** — A probabilistic search algorithm for decision-making
- **Neural Networks** — Deep learning models that guide the search and evaluate positions

This hybrid approach allows the bot to play strategically without hand-coded rules, learning entirely through self-play.

<div class="row justify-content-sm-center mt-4 mb-4">
    <div class="col-sm-8 mt-3 mt-md-0 text-center">
        <a href="https://spades-game-v2.vercel.app" target="_blank" class="btn btn-primary btn-lg">
            <i class="fas fa-gamepad"></i> Play Against the AI
        </a>
    </div>
</div>

---

## The Challenge

Spades presents a fascinating computational challenge. With 52 cards, 4 players, and complex bidding/playing phases, the game has approximately $$10^{20}$$ possible game states. The state space for possible deals alone is:

$$\binom{52}{13} \times \binom{39}{13} \times \binom{26}{13} \approx 5 \times 10^{28}$$

This enormous state space makes exhaustive search impossible, which is why we use Monte Carlo Tree Search to focus computational effort on the most promising moves.

---

## Monte Carlo Tree Search (MCTS)

Each MCTS iteration consists of four phases:

1. **Selection** — Navigate the tree using the Upper Confidence Bound (UCB1) formula
2. **Expansion** — Add new child nodes for unexplored actions
3. **Simulation** — Random rollout to get a game outcome
4. **Backpropagation** — Update statistics along the path

The UCB1 formula balances exploration and exploitation:

$$\text{UCB1}(s, a) = \underbrace{\frac{Q(s, a)}{N(s, a)}}_{\text{exploitation}} + \underbrace{c \cdot \sqrt{\frac{\ln N(s)}{N(s, a)}}}_{\text{exploration}}$$

---

## Three Neural Networks

The bot uses three specialized neural networks:

| Network | Purpose | Input Features |
|---------|---------|----------------|
| **NN1: Bidding Policy** | Predict optimal bid (0-13) | 8 features (scores, bags, previous bids) |
| **NN2: Playing Policy** | Select card to play | 326 features (hand, trick, card memory) |
| **NN3: Value Network** | Estimate win probability | 4 features (scores, bags differential) |

### Card Memory

A key innovation is the **card memory** system — 208 features (4 players × 52 cards) that track which cards each player has played. This enables card counting, improving win rate by approximately 15%.

---

## Self-Play Training

The bot improves through a self-play reinforcement learning loop:

1. **Self-Play** — Current best model plays games against itself
2. **Data Collection** — Record (state, action, outcome) tuples
3. **Training** — Update neural networks via supervised learning
4. **Evaluation** — Compare candidate model vs baseline
5. **Promotion** — If candidate wins ≥55% of games, it becomes the new baseline

This creates a **curriculum** where the bot continuously faces stronger opponents (itself), avoiding the need for human expert data.

---

## Training Progression

We measure bot strength using the ELO rating system:

| Training Time | Approximate ELO | Skill Level |
|---------------|-----------------|-------------|
| 0 min (start) | 1000 | Random play |
| 30 min | 1400-1600 | Beats random consistently |
| 60 min | 1700-1900 | Strategic bidding |
| 90 min | 1800-2100 | Card counting, team play |
| Ceiling | ~2200-2500 | Near-optimal with 150 sims |

---

## Technical Details

### Computational Efficiency

The bot is designed to run efficiently in the browser:

| Component | Operations | Browser Feasibility |
|-----------|------------|---------------------|
| MCTS (30 sims) | ~30 × game simulation | ✓ Fast |
| MCTS (150 sims) | ~150 × game simulation | ✓ Acceptable |
| NN2 inference | ~300K multiply-adds | ✓ Fast |

### PUCT Enhancement

We enhance standard MCTS with **Predictor Upper Confidence Trees (PUCT)**, which incorporates neural network priors:

$$\text{PUCT}(s, a) = \frac{Q(s, a)}{N(s, a)} + c \cdot P(a|s) \cdot \frac{\sqrt{N(s)}}{1 + N(s, a)}$$

Where $$P(a \vert s)$$ is the prior probability from the neural network, focusing search on promising moves.

---

## Try It Out

Play against the Spades AI yourself and see how you fare against a bot trained through self-play reinforcement learning:

<div class="row justify-content-sm-center mt-4 mb-4">
    <div class="col-sm-8 mt-3 mt-md-0 text-center">
        <a href="https://spades-game-v2.vercel.app" target="_blank" class="btn btn-primary btn-lg">
            <i class="fas fa-external-link-alt"></i> spades-game-v2.vercel.app
        </a>
    </div>
</div>

---

## References

1. Browne, C., et al. (2012). "A Survey of Monte Carlo Tree Search Methods"
2. Silver, D., et al. (2016). "Mastering the Game of Go with Deep Neural Networks and Tree Search"
3. Rosin, C. D. (2011). "Multi-armed Bandits with Episode Context"
4. ELO, A. (1978). "The Rating of Chessplayers, Past and Present"
