---
layout: page
title: NY Voting Patterns by Race
permalink: /voting_patterns/
description: Interactive map showing voting patterns by race and block group in New York using ecological inference estimates
map: true
---

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


