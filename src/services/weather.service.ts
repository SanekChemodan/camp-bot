import axios from 'axios';
import { config } from '../config';

type Coordinates = {
  lat: number;
  lon: number;
  name: string;
};

let cachedCoordinates: Coordinates | null = null;

const resolveCoordinates = async (): Promise<Coordinates> => {
  if (cachedCoordinates) {
    return cachedCoordinates;
  }

  if (config.campLat !== null && config.campLon !== null) {
    cachedCoordinates = {
      lat: config.campLat,
      lon: config.campLon,
      name: config.campCity,
    };
    return cachedCoordinates;
  }

  const response = await axios.get('http://api.openweathermap.org/geo/1.0/direct', {
    params: {
      q: config.campCity,
      limit: 1,
      appid: config.openWeatherApiKey,
    },
  });

  const place = response.data?.[0];
  if (!place) {
    throw new Error('Не удалось определить координаты лагеря.');
  }

  cachedCoordinates = {
    lat: place.lat,
    lon: place.lon,
    name: place.local_names?.ru || place.name || config.campCity,
  };

  return cachedCoordinates;
};

export const getWeatherText = async (): Promise<string> => {
  const coords = await resolveCoordinates();

  try {
    const response = await axios.get('https://api.openweathermap.org/data/3.0/onecall', {
      params: {
        lat: coords.lat,
        lon: coords.lon,
        exclude: 'minutely,hourly,alerts',
        units: 'metric',
        lang: 'ru',
        appid: config.openWeatherApiKey,
      },
    });

    const current = response.data.current;
    const today = response.data.daily?.[0];

    const description =
      today?.weather?.[0]?.description ||
      current?.weather?.[0]?.description ||
      'без описания';

    const rainChance =
      typeof today?.pop === 'number' ? `${Math.round(today.pop * 100)}%` : 'нет данных';

    return [
      `Погода на сегодня (${coords.name}):`,
      `Сейчас: ${Math.round(current.temp)}°C, ${current.weather?.[0]?.description ?? 'без описания'}`,
      `Днём: ${Math.round(today?.temp?.day ?? current.temp)}°C`,
      `Ночью: ${Math.round(today?.temp?.night ?? current.temp)}°C`,
      `Минимум: ${Math.round(today?.temp?.min ?? current.temp)}°C`,
      `Максимум: ${Math.round(today?.temp?.max ?? current.temp)}°C`,
      `Состояние: ${description}`,
      `Ветер: ${Math.round(current.wind_speed ?? 0)} м/с`,
      `Вероятность осадков: ${rainChance}`,
    ].join('\n');
  } catch {
    const fallback = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        lat: coords.lat,
        lon: coords.lon,
        units: 'metric',
        lang: 'ru',
        appid: config.openWeatherApiKey,
      },
    });

    const data = fallback.data;

    return [
      `Погода (${coords.name}):`,
      `Сейчас: ${Math.round(data.main.temp)}°C`,
      `Ощущается как: ${Math.round(data.main.feels_like)}°C`,
      `Состояние: ${data.weather?.[0]?.description ?? 'без описания'}`,
      `Ветер: ${Math.round(data.wind?.speed ?? 0)} м/с`,
      `Влажность: ${data.main?.humidity ?? 'нет данных'}%`,
    ].join('\n');
  }
};