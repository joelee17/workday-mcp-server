// Example: Using weather tool with OpenAI function calling
const OpenAI = require('openai');
const https = require('https');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Set your API key
});

// Weather function (same logic as MCP version)
async function getWeatherForCity(city) {
  // ... (same implementation as above)
  try {
    const data = await new Promise((resolve, reject) => {
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const options = {
        headers: { 'User-Agent': 'curl/7.68.0' },
        rejectUnauthorized: false
      };
      https.get(url, options, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
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
      location: `${location.areaName[0].value}, ${location.country[0].value}`,
      temperature: `${current.temp_C}°C (${current.temp_F}°F)`,
      condition: current.weatherDesc[0].value,
      humidity: `${current.humidity}%`,
      wind: `${current.windspeedKmph} km/h`
    };
  } catch (error) {
    throw new Error(`Failed to get weather for ${city}: ${error.message}`);
  }
}

// Function definition for OpenAI
const weatherFunction = {
  name: 'get_weather',
  description: 'Get current weather for a city',
  parameters: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'The city name'
      }
    },
    required: ['city']
  }
};

// Example usage with OpenAI
async function chatWithWeatherTool(userMessage) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant that can get weather information.' 
        },
        { role: 'user', content: userMessage }
      ],
      functions: [weatherFunction],
      function_call: 'auto'
    });
    
    const message = response.choices[0].message;
    
    // If AI wants to call the weather function
    if (message.function_call) {
      const { name, arguments: args } = message.function_call;
      
      if (name === 'get_weather') {
        const { city } = JSON.parse(args);
        const weather = await getWeatherForCity(city);
        
        // Send function result back to AI
        const followUpResponse = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that can get weather information.' },
            { role: 'user', content: userMessage },
            message,
            {
              role: 'function',
              name: 'get_weather',
              content: JSON.stringify(weather)
            }
          ]
        });
        
        return followUpResponse.choices[0].message.content;
      }
    }
    
    return message.content;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// Example usage:
// chatWithWeatherTool("What's the weather like in Tokyo?")
//   .then(response => console.log(response));

module.exports = { chatWithWeatherTool, getWeatherForCity }; 