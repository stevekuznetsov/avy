import React from 'react';

import {QueryClient, useQuery, UseQueryResult} from '@tanstack/react-query';
import axios, {AxiosError, AxiosResponse} from 'axios';

import * as Sentry from 'sentry-expo';

import {Logger} from 'browser-bunyan';
import {ClientContext, ClientProps} from 'clientContext';
import {formatDistanceToNowStrict} from 'date-fns';
import {safeFetch} from 'hooks/fetch';
import {LoggerContext, LoggerProps} from 'loggerContext';
import {AvalancheCenterID, reverseLookup} from 'types/nationalAvalancheCenter';
import {NotFoundError} from 'types/requests';
import {nominalNWACWeatherForecastDate, RequestedTime, requestedTimeToUTCDate, toDateTimeInterfaceATOM} from 'utils/date';
import {z, ZodError} from 'zod';

export const useNWACWeatherForecast = (
  center_id: AvalancheCenterID,
  zone_id: number,
  requestedTime: RequestedTime,
): UseQueryResult<NWACWeatherForecast | 'ignore', AxiosError | ZodError | NotFoundError> => {
  const {nwacHost} = React.useContext<ClientProps>(ClientContext);
  const date = requestedTimeToUTCDate(requestedTime);
  const {logger} = React.useContext<LoggerProps>(LoggerContext);
  const key = queryKey(nwacHost, zone_id, date);
  const thisLogger = logger.child({query: key});
  thisLogger.debug('initiating query');

  return useQuery<NWACWeatherForecast | 'ignore', AxiosError | ZodError | NotFoundError>({
    queryKey: key,
    queryFn: () => {
      if (center_id !== 'NWAC') {
        return new Promise(resolve => resolve('ignore'));
      } else {
        return fetchNWACWeatherForecast(nwacHost, zone_id, date, thisLogger);
      }
    },
    staleTime: 60 * 60 * 1000, // re-fetch in the background once an hour (in milliseconds)
    cacheTime: 24 * 60 * 60 * 1000, // hold on to this cached data for a day (in milliseconds)
  });
};

function queryKey(nwacHost: string, zone_id: number, requestedTime: Date) {
  return [
    'nwac-weather',
    {
      host: nwacHost,
      zone_id: zone_id,
      requestedTime: nominalNWACWeatherForecastDate(requestedTime),
    },
  ];
}

export const prefetchNWACWeatherForecast = async (queryClient: QueryClient, nwacHost: string, zone_id: number, requestedTime: Date, logger: Logger) => {
  const key = queryKey(nwacHost, zone_id, requestedTime);
  const thisLogger = logger.child({query: key});
  thisLogger.debug('initiating query');

  await queryClient.prefetchQuery({
    queryKey: key,
    queryFn: async () => {
      const start = new Date();
      logger.trace(`prefetching`);
      const result = fetchNWACWeatherForecast(nwacHost, zone_id, requestedTime, thisLogger);
      thisLogger.trace({duration: formatDistanceToNowStrict(start)}, `finished prefetching`);
      return result;
    },
  });
};

export const TimeOfDay = {
  '': '0-notspec',
  Morning: '1-morning',
  'Mid-day': '1a-midday',
  Afternoon: '2-afternoon',
  Evening: '3-evening',
  Night: '4-night',
} as const;
export type TimeOfDay = (typeof TimeOfDay)[keyof typeof TimeOfDay];

export const FormatTimeOfDay = (value: TimeOfDay): string => {
  return reverseLookup(TimeOfDay, value);
};

const nwacWeatherForecastSchema = z.object({
  five_thousand_foot_temperatures: z.array(
    z.object({
      min: z.number(),
      max: z.number(),
    }),
  ),
  forecaster: z.object({
    first_name: z.string(),
    last_name: z.string(),
  }),
  mountain_weather_forecast: z.object({
    id: z.number(),
    creation_date: z.string().transform(s => s.replace(' ', 'T') + '+00:00'), // YYYY-MM-DD HH:MM:SS  ... (UTC)
    publish_date: z.string().transform(s => s.replace(' ', 'T') + '+00:00'), // YYYY-MM-DD HH:MM:SS  ... (UTC)
    day1_date: z.string(), // YYYY-MM-DD
    special_header_notes: z.string(),
    synopsis_day1_day2: z.string(),
    extended_synopsis: z.string(),
    afternoon: z.coerce.boolean(),
  }),
  periods: z.array(z.string()),
  sub_periods: z.array(z.string()),
  precipitation_by_location: z.array(
    z.object({
      name: z.string(),
      order: z.number(),
      precipitation: z.array(
        z.object({
          value: z.string(),
        }),
      ),
    }),
  ),
  snow_levels: z.array(z.object({elevation: z.number()})),
  ridgeline_winds: z.array(
    z.object({
      direction: z.string().nullable(),
      speed: z.string().nullable(),
    }),
  ),
  weather_forecasts: z.array(
    z.object({
      date: z.string(), // YYYY-MM-DD
      time_of_day: z.nativeEnum(TimeOfDay),
      description: z.string(),
    }),
  ),
});

export type NWACWeatherForecast = z.infer<typeof nwacWeatherForecastSchema>;

const nwacWeatherForecastMetaSchema = z.object({
  meta: z.object({
    limit: z.number().optional().nullable(),
    next: z.string().optional().nullable(),
    offset: z.number().optional().nullable(),
    previous: z.string().optional().nullable(),
    total_count: z.number().optional().nullable(),
  }),
  objects: nwacWeatherForecastSchema,
});

export const fetchNWACWeatherForecast = async (nwacHost: string, zone_id: number, requestedTime: Date, logger: Logger): Promise<NWACWeatherForecast> => {
  const url = `${nwacHost}/api/v1/mountain-weather-region-forecast`;
  const params = {
    zone_id: zone_id,
    published_datetime: toDateTimeInterfaceATOM(requestedTime),
  };
  const what = 'NWAC weather forecast';
  const thisLogger = logger.child({url: url, params: params, what: what});
  const data = await safeFetch(
    () =>
      axios.get<AxiosResponse<unknown>>(url, {
        params: params,
      }),
    thisLogger,
    what,
  );

  const parseResult = nwacWeatherForecastMetaSchema.safeParse(data);
  if (!parseResult.success) {
    thisLogger.warn({error: parseResult.error}, 'failed to parse');
    Sentry.Native.captureException(parseResult.error, {
      tags: {
        zod_error: true,
        url,
      },
    });
    throw parseResult.error;
  } else {
    return parseResult.data.objects;
  }
};

export default {
  queryKey,
  fetch: fetchNWACWeatherForecast,
  prefetch: prefetchNWACWeatherForecast,
};
