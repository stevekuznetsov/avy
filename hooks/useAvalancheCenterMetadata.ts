import React from 'react';

import {QueryClient, useQuery, UseQueryResult} from '@tanstack/react-query';
import axios, {AxiosError, AxiosResponse} from 'axios';

import * as Sentry from 'sentry-expo';

import {Logger} from 'browser-bunyan';
import {ClientContext, ClientProps} from 'clientContext';
import {formatDistanceToNowStrict} from 'date-fns';
import {safeFetch} from 'hooks/fetch';
import {LoggerContext, LoggerProps} from 'loggerContext';
import {AvalancheCenter, AvalancheCenterID, avalancheCenterSchema} from 'types/nationalAvalancheCenter';
import {ZodError} from 'zod';

export const useAvalancheCenterMetadata = (center_id: AvalancheCenterID): UseQueryResult<AvalancheCenter, AxiosError | ZodError> => {
  const {nationalAvalancheCenterHost} = React.useContext<ClientProps>(ClientContext);
  const {logger} = React.useContext<LoggerProps>(LoggerContext);
  const key = queryKey(nationalAvalancheCenterHost, center_id);
  const thisLogger = logger.child({query: key});
  thisLogger.debug('initiating query');

  return useQuery<AvalancheCenter, AxiosError | ZodError>({
    queryKey: key,
    queryFn: async (): Promise<AvalancheCenter> => fetchAvalancheCenterMetadata(nationalAvalancheCenterHost, center_id, thisLogger),
    staleTime: 24 * 60 * 60 * 1000, // don't bother re-fetching for one day (in milliseconds)
    cacheTime: Infinity, // hold on to this cached data forever
  });
};

function queryKey(nationalAvalancheCenterHost: string, center_id: string) {
  return ['center-metadata', {host: nationalAvalancheCenterHost, center: center_id}];
}

export const prefetchAvalancheCenterMetadata = async (queryClient: QueryClient, nationalAvalancheCenterHost: string, center_id: AvalancheCenterID, logger: Logger) => {
  const key = queryKey(nationalAvalancheCenterHost, center_id);
  const thisLogger = logger.child({query: key});
  thisLogger.debug('initiating query');

  await queryClient.prefetchQuery({
    queryKey: key,
    queryFn: async (): Promise<AvalancheCenter> => {
      const start = new Date();
      thisLogger.trace(`prefetching`);
      const result = await fetchAvalancheCenterMetadata(nationalAvalancheCenterHost, center_id, thisLogger);
      thisLogger.trace({duration: formatDistanceToNowStrict(start)}, `finished prefetching`);
      return result;
    },
  });
};

export const fetchAvalancheCenterMetadataQuery = async (queryClient: QueryClient, nationalAvalancheCenterHost: string, center_id: AvalancheCenterID, logger: Logger) =>
  await queryClient.fetchQuery({
    queryKey: queryKey(nationalAvalancheCenterHost, center_id),
    queryFn: async (): Promise<AvalancheCenter> => {
      const result = await fetchAvalancheCenterMetadata(nationalAvalancheCenterHost, center_id, logger);
      return result;
    },
  });

const fetchAvalancheCenterMetadata = async (nationalAvalancheCenterHost: string, center_id: AvalancheCenterID, logger: Logger): Promise<AvalancheCenter> => {
  const url = `${nationalAvalancheCenterHost}/v2/public/avalanche-center/${center_id}`;
  const what = 'avalanche center metadata';
  const thisLogger = logger.child({url: url, center: center_id, what: what});
  const data = await safeFetch(() => axios.get<AxiosResponse<unknown>>(url), thisLogger, what);

  const parseResult = avalancheCenterSchema.safeParse(data);
  if (!parseResult.success) {
    thisLogger.warn({url: url, error: parseResult.error}, 'failed to parse');
    Sentry.Native.captureException(parseResult.error, {
      tags: {
        zod_error: true,
        center_id,
        url,
      },
    });
    throw parseResult.error;
  } else {
    return parseResult.data;
  }
};

export default {
  queryKey,
  fetchQuery: fetchAvalancheCenterMetadataQuery,
  prefetch: prefetchAvalancheCenterMetadata,
};
