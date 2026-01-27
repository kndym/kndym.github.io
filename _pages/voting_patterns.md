---
layout: page
title: vote estimator
permalink: /vote-estimator/
description: Interactive map showing estimated voting patterns by race in New York using ecological inference
map: true
nav: true
nav_order: 7
---

## Interactive Map

Explore estimated voting patterns by demographic group across New York block groups. Select a race and metric to visualize the spatial distribution of voting behavior.

<div class="voting-map-container">
  <div class="voting-map-controls mb-4">
    <div class="row">
      <div class="col-md-6 mb-3">
        <label for="race-select" class="form-label"><strong>Select Race:</strong></label>
        <select id="race-select" class="form-select">
          <option value="Wht">White</option>
          <option value="His">Hispanic</option>
          <option value="Blk">Black</option>
          <option value="Asn">Asian</option>
          <option value="Oth">Other</option>
        </select>
      </div>
      <div class="col-md-6 mb-3">
        <label for="metric-select" class="form-label"><strong>Select Metric:</strong></label>
        <select id="metric-select" class="form-select">
          <option value="margin">2020 Vote Margin</option>
          <option value="turnout">2020 Turnout</option>
        </select>
      </div>
    </div>
  </div>
  
  <div style="position: relative;">
    <div id="voting-map" style="width: 100%; min-height: 600px;"></div>
    <div id="map-legend" style="position: absolute; bottom: 20px; right: 20px; z-index: 1000; max-width: 200px;"></div>
  </div>
</div>

<script defer src="{{ '/assets/js/voting-map.js' | relative_url | bust_file_cache }}" type="text/javascript"></script>

---

## Methodology: Ecological Inference with Spatial Smoothing

This map displays estimates from a **spatially-smoothed ecological inference (EI) model** that infers voting behavior by demographic group from aggregate election results and census data.

### The Ecological Inference Problem

Election results are reported at the precinct level, but we only observe *total* votes — not how individuals within each demographic group voted. Given:

- $$D_{i,d}$$ — demographic population (Citizen Voting Age Population) for group $$d$$ in precinct $$i$$
- $$V_{i,k}$$ — observed vote totals for vote type $$k$$ (Democrat, Republican, Other, Non-vote) in precinct $$i$$

We seek to estimate:

$$p_{i,d,k}$$ — the probability that a person of demographic $$d$$ in precinct $$i$$ casts vote type $$k$$

Subject to constraints:
- $$p_{i,d,k} \geq 0$$ for all $$i, d, k$$
- $$\sum_k p_{i,d,k} = 1$$ for all $$i, d$$

### Forward Model

The predicted vote totals are computed by aggregating across demographics:

$$U_{i,k} = \sum_d p_{i,d,k} \cdot D_{i,d}$$

This ties demographic voting probabilities to observed totals.

### Objective Function

The model optimizes a combination of three loss components:

**1. Data Fit (L2 Loss)**

Penalizes discrepancy between predicted and observed vote totals:

$$\mathcal{L}_{\text{data}} = \sum_i \|U_i - V_i\|^2$$

**2. Spatial Smoothing (Neighbor-Weighted Laplacian)**

Encourages each precinct's probability vector to resemble a population-weighted neighbor average:

$$\bar{p}_{i,d} = \frac{\sum_j A_{ij} \cdot p_{j,d} \cdot D_{j,d}}{\sum_j A_{ij} \cdot D_{j,d} + \epsilon}$$

$$\mathcal{L}_{\text{spatial}} = \sum_{i,d} \|p_{i,d} - \bar{p}_{i,d}\|^2$$

where $$A_{ij}$$ is the adjacency matrix indicating neighboring precincts.

**3. Entropy Regularization**

Prevents degenerate (all-or-nothing) probability distributions:

$$\mathcal{L}_{\text{entropy}} = \sum_{i,d,k} p_{i,d,k} \log(p_{i,d,k} + \epsilon)$$

**Total Loss:**

$$\mathcal{L} = \mathcal{L}_{\text{data}} + \lambda_{\text{spatial}} \cdot \mathcal{L}_{\text{spatial}} + \lambda_{\text{entropy}} \cdot \mathcal{L}_{\text{entropy}}$$

### Low-Population Handling

Precincts with small demographic populations are unreliable for inference. The model blends low-population cells toward their neighbor-weighted average:

$$w_i = \exp\left(-\frac{D_i}{\sigma}\right)$$

$$p_i \leftarrow (1 - w_i) \cdot p_i + w_i \cdot \bar{p}_i$$

This ensures:
- Low-population precincts inherit signal from neighbors
- High-population precincts remain largely unchanged

### Optimization

The model is optimized using **Adam** in probability space with simplex projection after each step:

$$p \leftarrow \text{clip}(p, \epsilon, \infty)$$
$$p \leftarrow \frac{p}{\sum_k p_k}$$

### Interpretation

| Component | Purpose |
|-----------|---------|
| **Data fit** | Ensures consistency with observed election totals |
| **Neighbor smoothing** | Propagates high-population signal across the spatial graph |
| **Entropy** | Prevents extreme, brittle distributions |
| **Low-pop blending** | Steers unreliable estimates toward neighbor averages |

### Data Sources

- **Election Data**: 2020 Presidential Election results by precinct
- **Demographic Data**: Census Bureau Citizen Voting Age Population (CVAP) by block group
- **Geography**: Block group shapefiles matched to precinct boundaries

### Limitations

- Ecological inference is inherently uncertain — these are *estimates*, not direct observations
- The model assumes voting behavior varies smoothly across space
- Results are sensitive to hyperparameters (spatial weight, entropy weight, low-population scale)


