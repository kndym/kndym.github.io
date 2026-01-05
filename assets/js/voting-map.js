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

  // Load CSV data
  async function loadCSV() {
    if (csvData) return csvData;
    
    const baseUrl = getBaseUrl();
    const csvUrl = `${baseUrl}/assets/data/ny_estimates.csv`;
    
    try {
      const response = await fetch(csvUrl);
      const text = await response.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',');
      
      csvData = {};
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',');
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

  // Calculate metric value
  function calculateMetric(race, metric, row) {
    const racePrefix = RACES[race].prefix;
    const demField = `D_${racePrefix}_prob`;
    const repField = `R_${racePrefix}_prob`;
    const otherField = `O_${racePrefix}_prob`;
    const nonVoterField = `N_${racePrefix}_prob`;

    const dem = parseFloat(row[demField]) || 0;
    const rep = parseFloat(row[repField]) || 0;
    const other = parseFloat(row[otherField]) || 0;
    const nonVoter = parseFloat(row[nonVoterField]) || 0;
    const total = dem + rep + other + nonVoter;

    if (total === 0) return null;

    if (metric === 'margin') {
      // Margin = (Dem - Rep) / Total
      return (dem - rep) / total;
    } else {
      // Turnout = (Dem + Rep + Other) / Total * 100
      return ((dem + rep + other) / total) * 100;
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
    const racePrefix = RACES[currentRace].prefix;
    const demField = `D_${racePrefix}_prob`;
    const repField = `R_${racePrefix}_prob`;
    const otherField = `O_${racePrefix}_prob`;

    const metricLabel = currentMetric === 'margin' ? 'Margin' : 'Turnout %';
    const metricValue = value !== null && isFinite(value)
      ? (currentMetric === 'margin' ? value.toFixed(3) : value.toFixed(1) + '%')
      : 'N/A';

    // Convert probabilities to percentages (multiply by 100)
    const demPercent = ((parseFloat(row[demField]) || 0) * 100).toFixed(1);
    const repPercent = ((parseFloat(row[repField]) || 0) * 100).toFixed(1);
    const otherPercent = ((parseFloat(row[otherField]) || 0) * 100).toFixed(1);

    return `
      <div style="color: black !important;">
        <strong>${countyName}, Block Group ${blockGroup}</strong><br/>
        <strong>${metricLabel}:</strong> ${metricValue}<br/>
        <strong>Dem %:</strong> ${demPercent}%<br/>
        <strong>Rep %:</strong> ${repPercent}%<br/>
        <strong>Other %:</strong> ${otherPercent}%
      </div>
    `;
  }

  // Create legend
  function createLegend(min, max) {
    const legendContainer = document.getElementById('map-legend');
    if (!legendContainer) return;

    const title = currentMetric === 'margin'
      ? `${RACES[currentRace].label} - Margin (Dem - Rep) / Total`
      : `${RACES[currentRace].label} - Turnout %`;

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
