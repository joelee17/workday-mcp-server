const express = require('express');
const https = require('https');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Weather function (same as MCP version)
async function getWeatherForCity(city) {
  try {
    const data = await new Promise((resolve, reject) => {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const options = {
        headers: {
          'User-Agent': 'curl/7.68.0'
        },
        rejectUnauthorized: false
      };
      https.get(url, options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch (error) {
            reject(new Error(`Failed to parse weather data: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Network error: ${error.message}`));
      });
    });
    
    const current = data.current_condition[0];
    const location = data.nearest_area[0];
    
    return {
      location: {
        city: location.areaName[0].value,
        country: location.country[0].value,
        region: location.region[0].value,
      },
      current: {
        temperature_celsius: current.temp_C,
        temperature_fahrenheit: current.temp_F,
        condition: current.weatherDesc[0].value,
        humidity: current.humidity,
        wind_speed_kmh: current.windspeedKmph,
      }
    };
  } catch (error) {
    throw new Error(`Failed to get weather for ${city}: ${error.message}`);
  }
}

// REST API Routes
app.get('/api/weather/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const weather = await getWeatherForCity(city);
    res.json({
      success: true,
      data: weather
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List available tools
app.get('/api/tools', (req, res) => {
  res.json({
    success: true,
    tools: [
      {
        name: 'get_weather',
        description: 'Get weather for a city',
        method: 'GET',
        endpoint: '/api/weather/:city'
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`✅ Weather REST API running on http://localhost:${PORT}`);
  console.log(`📍 Test: curl "http://localhost:${PORT}/api/weather/London"`);
}); 