// Voting Map Interactive Controller using Leaflet
// Handles dynamic updates to the Leaflet choropleth map based on race and metric selections

(function() {
  'use strict';

  // Race and metric configuration
  const RACES = {
    'Wht': { label: 'White', prefix: 'Wht' },
    'His': { label: 'Hispanic', prefix: 'His' },
    'Blk': { label: 'Black', prefix: 'Blk' },
    'Asn': { label: 'Asian', prefix: 'Asn' },
    'Oth': { label: 'Other', prefix: 'Oth' }
  };

  // NY County FIPS code to county name mapping
  const NY_COUNTIES = {
    '001': 'Albany',
    '003': 'Allegany',
    '005': 'Bronx',
    '007': 'Broome',
    '009': 'Cattaraugus',
    '011': 'Cayuga',
    '013': 'Chautauqua',
    '015': 'Chemung',
    '017': 'Chenango',
    '019': 'Clinton',
    '021': 'Columbia',
    '023': 'Cortland',
    '025': 'Delaware',
    '027': 'Dutchess',
    '029': 'Erie',
    '031': 'Essex',
    '033': 'Franklin',
    '035': 'Fulton',
    '037': 'Genesee',
    '039': 'Greene',
    '041': 'Hamilton',
    '043': 'Herkimer',
    '045': 'Jefferson',
    '047': 'Kings',
    '049': 'Lewis',
    '051': 'Livingston',
    '053': 'Madison',
    '055': 'Monroe',
    '057': 'Montgomery',
    '059': 'Nassau',
    '061': 'New York',
    '063': 'Niagara',
    '065': 'Oneida',
    '067': 'Onondaga',
    '069': 'Ontario',
    '071': 'Orange',
    '073': 'Orleans',
    '075': 'Oswego',
    '077': 'Otsego',
    '079': 'Putnam',
    '081': 'Queens',
    '083': 'Rensselaer',
    '085': 'Richmond',
    '087': 'Rockland',
    '089': 'St. Lawrence',
    '091': 'Saratoga',
    '093': 'Schenectady',
    '095': 'Schoharie',
    '097': 'Schuyler',
    '099': 'Seneca',
    '101': 'Steuben',
    '103': 'Suffolk',
    '105': 'Sullivan',
    '107': 'Tioga',
    '109': 'Tompkins',
    '111': 'Ulster',
    '113': 'Warren',
    '115': 'Washington',
    '117': 'Wayne',
    '119': 'Westchester',
    '121': 'Wyoming',
    '123': 'Yates'
  };

  let currentRace = 'Wht';
  let currentMetric = 'margin';
  let map = null;
  let geoJsonLayer = null;
  let geoJsonData = null;
  let csvData = null;
  let legend = null;

  // Get base URL for assets
  function getBaseUrl() {
    const baseUrl = document.querySelector('base')?.href || '';
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  // Load GeoJSON data
  async function loadGeoJSON() {
    if (geoJsonData) return geoJsonData;
    
    const baseUrl = getBaseUrl();
    const geojsonUrl = `${baseUrl}/assets/data/ny_state_blkgrp.geojson`;
    
    try {
      const response = await fetch(geojsonUrl);
      geoJsonData = await response.json();
      return geoJsonData;
    } catch (error) {
      console.error('Error loading GeoJSON:', error);
      throw error;
    }
  }

  function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  // Load CSV data
  async function loadCSV() {
    if (csvData) return csvData;
    
    const baseUrl = getBaseUrl();
    const csvUrl = `${baseUrl}/assets/data/ny_estimates_min.csv`;
    
    try {
      const response = await fetch(csvUrl);
      const text = await response.text();
      const lines = text.split(/\r?\n/);
      const headers = parseCsvLine(lines[0]);
      
      csvData = {};
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = parseCsvLine(lines[i]);
          const row = {};
          headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : '';
          });
          if (row.AFFGEOID) {
            csvData[row.AFFGEOID] = row;
          }
        }
      }
      return csvData;
    } catch (error) {
      console.error('Error loading CSV:', error);
      throw error;
    }
  }

  function getRaceProbabilities(race, row) {
    const racePrefix = RACES[race].prefix;
    const demProbField = `D_${racePrefix}_prob`;
    const repProbField = `R_${racePrefix}_prob`;
    const otherProbField = `O_${racePrefix}_prob`;
    const nonVoterProbField = `N_${racePrefix}_prob`;
    const hasProbFields = demProbField in row || repProbField in row || otherProbField in row || nonVoterProbField in row;
    if (!hasProbFields) {
      return { dem: 0, rep: 0, other: 0, nonVoter: 0, hasData: false };
    }

    const demProb = parseFloat(row[demProbField]) || 0;
    const repProb = parseFloat(row[repProbField]) || 0;
    const otherProb = parseFloat(row[otherProbField]) || 0;
    const nonVoterProb = parseFloat(row[nonVoterProbField]) || 0;

    return {
      dem: demProb,
      rep: repProb,
      other: otherProb,
      nonVoter: nonVoterProb,
      hasData: true
    };
  }

  // Calculate metric value
  function calculateMetric(race, metric, row) {
    const probs = getRaceProbabilities(race, row);
    if (!probs.hasData) return null;
    const dem = probs.dem;
    const rep = probs.rep;
    const other = probs.other;
    const nonVoter = probs.nonVoter;

    if (metric === 'margin') {
      // Margin based on probabilities excluding non-voters
      const totalVotes = dem + rep + other;
      if (totalVotes === 0) return 0;
      return (dem - rep) / totalVotes;
    } else {
      // Turnout = (1 - NonVoter) * 100 based on probabilities
      return (1 - nonVoter) * 100;
    }
  }

  // Get color for margin using specified color stops
  // -1: #02273d, -0.5: #ca0020, 0: #ffffff, 0.5: #0571b0, 1: #02273d
  // Map actual data range to these color stops
  function getColorForMargin(value, min, max) {
    // Normalize value to 0-1 based on actual data range
    const normalized = (value - min) / (max - min);
    
    // Map normalized (0-1) to color stop positions (-1 to 1)
    // This maps: min -> -1, 25% -> -0.5, 50% -> 0, 75% -> 0.5, max -> 1
    const mappedValue = -1 + normalized * 2; // Maps 0->-1, 1->1
    
    // Color stops at specific positions
    const stops = [
      { position: -1, color: [2, 39, 61] },      // #02273d
      { position: -0.5, color: [202, 0, 32] },   // #ca0020
      { position: 0, color: [255, 255, 255] },    // #ffffff
      { position: 0.5, color: [5, 113, 176] },    // #0571b0
      { position: 1, color: [2, 39, 61] }          // #02273d
    ];
    
    // Find the two stops to interpolate between
    let lowerStop = stops[0];
    let upperStop = stops[1];
    
    for (let i = 0; i < stops.length - 1; i++) {
      if (mappedValue >= stops[i].position && mappedValue <= stops[i + 1].position) {
        lowerStop = stops[i];
        upperStop = stops[i + 1];
        break;
      }
    }
    
    // Interpolate between the two stops
    const range = upperStop.position - lowerStop.position;
    const t = range === 0 ? 0 : (mappedValue - lowerStop.position) / range;
    
    const r = Math.round(lowerStop.color[0] + t * (upperStop.color[0] - lowerStop.color[0]));
    const g = Math.round(lowerStop.color[1] + t * (upperStop.color[1] - lowerStop.color[1]));
    const b = Math.round(lowerStop.color[2] + t * (upperStop.color[2] - lowerStop.color[2]));
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Get color for turnout (sequential: light green to deep green)
  // Values below 40% are clamped to light green
  // Values above 90% are clamped to deep green
  // Values between 40% and 90% interpolate between light and deep green
  function getColorForTurnout(value, min, max) {
    // Clamp value to 40-90 range for color mapping (percentages)
    const clampedValue = Math.max(40, Math.min(90, value));
    
    // Normalize clamped value to 0-1 for interpolation
    // Map 40 -> 0, 90 -> 1
    const normalized = (clampedValue - 40) / (90 - 40);
    
    // Light green: rgb(199, 233, 192) - approximately #c7e9c0
    // Deep green: rgb(0, 104, 55) - approximately #006837
    const lightGreen = [199, 233, 192];
    const deepGreen = [0, 104, 55];
    
    const r = Math.round(lightGreen[0] + normalized * (deepGreen[0] - lightGreen[0]));
    const g = Math.round(lightGreen[1] + normalized * (deepGreen[1] - lightGreen[1]));
    const b = Math.round(lightGreen[2] + normalized * (deepGreen[2] - lightGreen[2]));
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Get color based on metric
  function getColor(value, metric, min, max) {
    if (value === null || !isFinite(value)) return '#ccc';
    if (metric === 'margin') {
      return getColorForMargin(value, min, max);
    } else {
      return getColorForTurnout(value, min, max);
    }
  }

  // Calculate all metric values and get min/max
  function calculateAllMetrics(race, metric) {
    const values = [];
    
    if (geoJsonData && csvData) {
      geoJsonData.features.forEach((feature) => {
        const affgeoid = feature.properties.AFFGEOID;
        const row = csvData[affgeoid];
        if (row) {
          const value = calculateMetric(race, metric, row);
          if (value !== null && isFinite(value)) {
            values.push(value);
          }
        }
      });
    }

    if (metric === 'margin') {
      return { values, min: -1, max: 1 };
    }
    
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 1;
    
    return { values, min, max };
  }

  // Style function for GeoJSON layer
  function styleFeature(feature, min, max) {
    const affgeoid = feature.properties.AFFGEOID;
    const row = csvData[affgeoid];
    
    if (!row) {
      return {
        fillColor: '#ccc',
        weight: 0.2,
        opacity: 1,
        color: '#fff',
        fillOpacity: 0.75
      };
    }

    const value = calculateMetric(currentRace, currentMetric, row);
    const color = getColor(value, currentMetric, min, max);
    
    return {
      fillColor: color,
      weight: 0.2,
      opacity: 1,
      color: '#fff',
      fillOpacity: 0.75
    };
  }

  // Create popup content
  function createPopupContent(feature) {
    const affgeoid = feature.properties.AFFGEOID;
    const row = csvData[affgeoid];
    
    // Extract county FIPS code and block group from GeoJSON properties
    const countyFips = feature.properties.COUNTYFP || '';
    const blockGroup = feature.properties.BLKGRPCE || '';
    const countyName = NY_COUNTIES[countyFips] || `County ${countyFips}`;
    
    if (!row) {
      return `<div style="color: black !important;"><strong>${countyName}, Block Group ${blockGroup}</strong><br/>No data available</div>`;
    }

    const value = calculateMetric(currentRace, currentMetric, row);
    const probs = getRaceProbabilities(currentRace, row);
    if (!probs.hasData) {
      return `<div style="color: black !important;"><strong>${countyName}, Block Group ${blockGroup}</strong><br/>No data available</div>`;
    }
    const dem = probs.dem;
    const rep = probs.rep;
    const other = probs.other;
    const nonVoter = probs.nonVoter;

    if (currentMetric === 'margin') {
      // Margin map: Show Dem, Rep, and Other probabilities with winner
      const totalVotes = dem + rep + other;

      const demPercent = (dem * 100).toFixed(1);
      const repPercent = (rep * 100).toFixed(1);
      const otherPercent = (other * 100).toFixed(1);

      // Determine winner
      let winner = '';
      let winnerLead = '';
      if (totalVotes === 0) {
        winner = 'No votes';
        winnerLead = '';
      } else if (dem > rep && dem > other) {
        const leadPercent = ((dem - rep) / totalVotes * 100).toFixed(1);
        winner = 'Biden';
        winnerLead = `+${leadPercent}%`;
      } else if (rep > dem && rep > other) {
        const leadPercent = ((rep - dem) / totalVotes * 100).toFixed(1);
        winner = 'Trump';
        winnerLead = `+${leadPercent}%`;
      } else if (other > dem && other > rep) {
        winner = 'Other';
        winnerLead = '';
      } else {
        winner = 'Tie';
        winnerLead = '';
      }

      const marginValue = value !== null && isFinite(value) ? (value * 100).toFixed(1) + '%' : 'N/A';

      return `
        <div style="color: black !important;">
          <strong>${countyName}, Block Group ${blockGroup}</strong><br/>
          <strong>Biden:</strong> ${demPercent}%<br/>
          <strong>Trump:</strong> ${repPercent}%<br/>
          <strong>Other:</strong> ${otherPercent}%<br/>
          <strong>Winner:</strong> ${winner} ${winnerLead ? winnerLead : ''}<br/>
          <strong>Margin:</strong> ${marginValue}
        </div>
      `;
    } else {
      // Turnout map: Show Voted vs Non Voters probabilities
      const voted = dem + rep + other;
      const votedPercent = (voted * 100).toFixed(1);
      const nonVoterPercent = (nonVoter * 100).toFixed(1);
      const turnoutValue = value !== null && isFinite(value) ? value.toFixed(1) + '%' : 'N/A';

      return `
        <div style="color: black !important;">
          <strong>${countyName}, Block Group ${blockGroup}</strong><br/>
          <strong>Voted:</strong> ${votedPercent}%<br/>
          <strong>Non Voters:</strong> ${nonVoterPercent}%<br/>
          <strong>Turnout:</strong> ${turnoutValue}
        </div>
      `;
    }
  }

  // Create legend
  function createLegend(min, max) {
    const legendContainer = document.getElementById('map-legend');
    if (!legendContainer) return;

    const title = currentMetric === 'margin'
      ? `${RACES[currentRace].label} - 2020 Vote Margin`
      : `${RACES[currentRace].label} - 2020 Turnout`;

    let html = `<div class="map-legend" style="background: white !important; padding: 10px; border-radius: 5px; box-shadow: 0 1px 5px rgba(0,0,0,0.4);"><strong style="opacity: 1; color: black !important;">${title}</strong><br/>`;
    
    if (currentMetric === 'margin') {
      // Diverging legend: -1: #02273d, -0.5: #ca0020, 0: #ffffff, 0.5: #0571b0, 1: #02273d
      html += '<div class="legend-gradient" style="background: linear-gradient(to right, #02273d, #ca0020, #ffffff, #0571b0, #02273d); height: 20px; width: 100%; margin: 5px 0;"></div>';
      html += `<div style="display: flex; justify-content: space-between; font-size: 12px; opacity: 1; color: black !important;">`;
      html += `<span style="opacity: 1; color: black !important;">${min.toFixed(2)}</span>`;
      html += `<span style="opacity: 1; color: black !important;">0</span>`;
      html += `<span style="opacity: 1; color: black !important;">${max.toFixed(2)}</span>`;
      html += `</div>`;
    } else {
      // Sequential legend: light green to deep green
      html += '<div class="legend-gradient" style="background: linear-gradient(to right, rgb(199, 233, 192), rgb(0, 104, 55)); height: 20px; width: 100%; margin: 5px 0;"></div>';
      html += `<div style="display: flex; justify-content: space-between; font-size: 12px; opacity: 1; color: black !important;">`;
      html += `<span style="opacity: 1; color: black !important;">${min.toFixed(1)}%</span>`;
      html += `<span style="opacity: 1; color: black !important;">${max.toFixed(1)}%</span>`;
      html += `</div>`;
    }
    
    html += '</div>';
    legendContainer.innerHTML = html;
  }

  // Update the map
  async function updateMap() {
    const container = document.getElementById('voting-map');
    if (!container) return;

    try {
      // Load data if not already loaded
      await loadGeoJSON();
      await loadCSV();

      // Initialize map if needed
      if (!map) {
        // Center on New York state
        map = L.map(container).setView([40.7128, -74.0060], 8);
        
        // Add tile layer
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Handle window resize
        window.addEventListener('resize', () => {
          map.invalidateSize();
        });
      }

      // Calculate min/max for color scaling
      const { min, max } = calculateAllMetrics(currentRace, currentMetric);

      // Remove existing layer if present
      if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
      }

      // Create styled GeoJSON layer
      geoJsonLayer = L.geoJSON(geoJsonData, {
        style: function(feature) {
          return styleFeature(feature, min, max);
        },
        onEachFeature: function(feature, layer) {
          // Add popup on click
          const popupContent = createPopupContent(feature);
          layer.bindPopup(popupContent);
          
          // Add hover effect
          layer.on({
            mouseover: function(e) {
              const layer = e.target;
              layer.setStyle({
                weight: 1.5,
                color: '#666',
                fillOpacity: 0.9
              });
              
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
              }
            },
            mouseout: function(e) {
              geoJsonLayer.resetStyle(e.target);
            }
          });
        }
      }).addTo(map);

      // Fit bounds to show all features
      if (geoJsonLayer.getBounds().isValid()) {
        map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
      }

      // Update legend
      createLegend(min, max);
    } catch (error) {
      console.error('Error updating map:', error);
    }
  }

  // Initialize controls
  function initializeControls() {
    const raceSelect = document.getElementById('race-select');
    const metricSelect = document.getElementById('metric-select');

    if (raceSelect) {
      raceSelect.addEventListener('change', (e) => {
        currentRace = e.target.value;
        updateMap();
      });
    }

    if (metricSelect) {
      metricSelect.addEventListener('change', (e) => {
        currentMetric = e.target.value;
        updateMap();
      });
    }
  }

  // Initialize on page load
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // Wait for Leaflet to load
    if (typeof L === 'undefined') {
      setTimeout(init, 100);
      return;
    }

    initializeControls();
    updateMap();
  }

  // Start initialization
  init();
})();
