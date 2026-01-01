import * as z from "zod";

// Zod schemas for OpenWeatherMap One Call API 3.0
const WeatherConditionSchema = z.object({
  id: z.number(),
  main: z.string(),
  description: z.string(),
  icon: z.string(),
});

const CurrentWeatherSchema = z.object({
  dt: z.number(),
  sunrise: z.number().optional(),
  sunset: z.number().optional(),
  temp: z.number(),
  feels_like: z.number(),
  pressure: z.number(),
  humidity: z.number(),
  dew_point: z.number().optional(),
  uvi: z.number().optional(),
  clouds: z.number(),
  visibility: z.number().optional(),
  wind_speed: z.number(),
  wind_deg: z.number(),
  wind_gust: z.number().optional(),
  weather: z.array(WeatherConditionSchema),
  rain: z.object({ "1h": z.number() }).optional(),
  snow: z.object({ "1h": z.number() }).optional(),
});

const DailyTempSchema = z.object({
  day: z.number(),
  min: z.number(),
  max: z.number(),
  night: z.number(),
  eve: z.number(),
  morn: z.number(),
});

const DailyWeatherSchema = z.object({
  dt: z.number(),
  sunrise: z.number().optional(),
  sunset: z.number().optional(),
  moonrise: z.number().optional(),
  moonset: z.number().optional(),
  moon_phase: z.number().optional(),
  summary: z.string().optional(),
  temp: DailyTempSchema,
  feels_like: z.object({
    day: z.number(),
    night: z.number(),
    eve: z.number(),
    morn: z.number(),
  }),
  pressure: z.number(),
  humidity: z.number(),
  dew_point: z.number().optional(),
  wind_speed: z.number(),
  wind_deg: z.number(),
  wind_gust: z.number().optional(),
  weather: z.array(WeatherConditionSchema),
  clouds: z.number(),
  pop: z.number(),
  rain: z.number().optional(),
  snow: z.number().optional(),
  uvi: z.number().optional(),
});

// Schema for current/forecast endpoint (has "current" field)
const OneCallResponseSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  timezone: z.string(),
  timezone_offset: z.number(),
  current: CurrentWeatherSchema,
  daily: z.array(DailyWeatherSchema).optional(),
  hourly: z.array(z.unknown()).optional(),
  minutely: z.array(z.unknown()).optional(),
  alerts: z.array(z.unknown()).optional(),
});

// Schema for timemachine endpoint (has "data" array instead of "current")
const TimeMachineResponseSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  timezone: z.string(),
  timezone_offset: z.number(),
  data: z.array(CurrentWeatherSchema),
});

// TypeScript types
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;
export type CurrentWeather = z.infer<typeof CurrentWeatherSchema>;
export type DailyWeather = z.infer<typeof DailyWeatherSchema>;
export type OneCallResponse = z.infer<typeof OneCallResponseSchema>;
export type TimeMachineResponse = z.infer<typeof TimeMachineResponseSchema>;

// Hanoi coordinates
const HANOI_LAT = 21.0285;
const HANOI_LON = 105.8542;

/**
 * Extract date from query text
 * Returns date string in YYYY-MM-DD format or null
 */
export function extractDateFromQuery(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  // Handle relative dates first
  if (lowerQuery.includes('today')) {
    return new Date().toISOString().split('T')[0];
  } else if (lowerQuery.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  } else if (lowerQuery.includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  
  // Try to match various date formats
  const datePatterns = [
    {
      pattern: /(\d{4}-\d{2}-\d{2})/,
      parser: (match: string) => {
        // Already in YYYY-MM-DD format
        const date = new Date(match);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
        return null;
      }
    },
    {
      pattern: /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
      parser: (match: string) => {
        const date = new Date(match);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
        return null;
      }
    },
    {
      pattern: /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})/i,
      parser: (match: string) => {
        const date = new Date(match);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
        return null;
      }
    },
    {
      pattern: /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
      parser: (match: string) => {
        // Handle both DD/MM/YYYY and DD/MM/YY formats
        const parts = match.split('/');
        if (parts.length === 3) {
          let year = parseInt(parts[2]);
          // If 2-digit year, convert to 4-digit:
          // All 2-digit years (00-99) -> 2000-2099
          if (year < 100) {
            year = 2000 + year;
          }
          // Try DD/MM/YYYY format (common in many countries)
          const date = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
        return null;
      }
    },
    {
      pattern: /(\d{1,2}-\d{1,2}-\d{4})/,
      parser: (match: string) => {
        // Try parsing as MM-DD-YYYY
        const parts = match.split('-');
        if (parts.length === 3) {
          const date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
        return null;
      }
    },
  ];

  for (const { pattern, parser } of datePatterns) {
    const match = query.match(pattern);
    if (match) {
      const dateStr = parser(match[0]);
      if (dateStr) {
        return dateStr;
      }
    }
  }
  
  return null;
}

/**
 * Check if vector store matches contain data for a specific date
 */
export function hasDateInMatches(matches: Array<{ fields?: { date?: string }; date?: string; metadata?: { date?: string } }>, targetDate: string): boolean {
  return matches.some(match => {
    const date = match.fields?.date || match.date || match.metadata?.date;
    return date === targetDate;
  });
}

/**
 * Fetch weather data from OpenWeatherMap One Call API 3.0
 */
export async function fetchWeatherData(
  lat: number = HANOI_LAT,
  lon: number = HANOI_LON,
  date?: string
): Promise<OneCallResponse> {
  if (!process.env.OPENWEATHER_API_KEY) {
    throw new Error("OPENWEATHER_API_KEY is not set in environment variables");
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  let url: string;

  if (date) {
    // Use timemachine endpoint for specific date
    const timestamp = Math.floor(new Date(date).getTime() / 1000);
    url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${timestamp}&units=metric&appid=${apiKey}`;
  } else {
    // Use current and forecast endpoint
    url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely&units=metric&appid=${apiKey}`;
  }

  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;
    
    // Handle specific error cases
    if (response.status === 401) {
      errorMessage = "OpenWeatherMap API subscription required. One Call API 3.0 requires a separate subscription. Please subscribe at https://openweathermap.org/price or use the free Current Weather API instead.";
    } else if (response.status === 404) {
      errorMessage = "Weather data not found for the requested location or date.";
    } else if (response.status === 429) {
      errorMessage = "OpenWeatherMap API rate limit exceeded. Please try again later.";
    } else {
      errorMessage = `OpenWeatherMap API error (${response.status}): ${errorText}`;
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // Handle different response structures based on endpoint
  if (date) {
    // Timemachine endpoint returns { data: [...] }
    const timeMachineData = TimeMachineResponseSchema.parse(data);
    
    // Convert to OneCallResponse format by using first item in data array as "current"
    if (timeMachineData.data.length === 0) {
      throw new Error("No weather data available for the requested date");
    }
    
    // Normalize timemachine response to OneCallResponse format
    return {
      lat: timeMachineData.lat,
      lon: timeMachineData.lon,
      timezone: timeMachineData.timezone,
      timezone_offset: timeMachineData.timezone_offset,
      current: timeMachineData.data[0], // Use first data point as current
      daily: undefined,
      hourly: undefined,
      minutely: undefined,
      alerts: undefined,
    };
  } else {
    // Current/forecast endpoint returns { current: {...}, daily: [...] }
    return OneCallResponseSchema.parse(data);
  }
}

/**
 * Format weather data as context string for RAG
 */
export function formatWeatherContext(weatherData: OneCallResponse, date?: string): string {
  const { current, daily } = weatherData;
  
  let context = `**Hanoi Weather Forecast${date ? ` - ${date}` : ' - Current'}**\n\n`;
  context += `Location: Hanoi, Vietnam\n`;
  context += `Timezone: ${weatherData.timezone}\n\n`;
  
  // Current weather
  context += `**Current Weather:**\n`;
  context += `Temperature: ${current.temp}°C (feels like ${current.feels_like}°C)\n`;
  context += `Condition: ${current.weather[0]?.description || 'N/A'}\n`;
  context += `Humidity: ${current.humidity}%\n`;
  context += `Pressure: ${current.pressure} hPa\n`;
  context += `Wind Speed: ${current.wind_speed} m/s from ${current.wind_deg}°\n`;
  if (current.visibility) {
    context += `Visibility: ${current.visibility / 1000} km\n`;
  }
  if (current.clouds) {
    context += `Cloudiness: ${current.clouds}%\n`;
  }
  if (current.uvi !== undefined) {
    context += `UV Index: ${current.uvi}\n`;
  }
  if (current.rain?.["1h"]) {
    context += `Rain (last hour): ${current.rain["1h"]} mm\n`;
  }
  if (current.snow?.["1h"]) {
    context += `Snow (last hour): ${current.snow["1h"]} mm\n`;
  }
  
  // Daily forecast if available
  if (daily && daily.length > 0) {
    context += `\n**Daily Forecast:**\n`;
    daily.slice(0, 3).forEach((day) => {
      const dayDate = new Date(day.dt * 1000).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      context += `\n${dayDate}:\n`;
      context += `  Temperature: ${day.temp.min}°C - ${day.temp.max}°C\n`;
      context += `  Condition: ${day.weather[0]?.description || 'N/A'}\n`;
      context += `  Humidity: ${day.humidity}%\n`;
      context += `  Wind: ${day.wind_speed} m/s from ${day.wind_deg}°\n`;
      if (day.pop !== undefined) {
        context += `  Precipitation Probability: ${(day.pop * 100).toFixed(0)}%\n`;
      }
      if (day.rain) {
        context += `  Rain: ${day.rain} mm\n`;
      }
      if (day.snow) {
        context += `  Snow: ${day.snow} mm\n`;
      }
    });
  }
  
  return context;
}
