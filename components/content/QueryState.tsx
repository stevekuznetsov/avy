import {useNavigation} from '@react-navigation/native';
import {UseQueryResult} from '@tanstack/react-query';
import ErrorIllustration from 'assets/illustrations/Error.svg';
import NoGPS from 'assets/illustrations/NoGPS.svg';
import NoSearchResult from 'assets/illustrations/NoSearchResult.svg';
import {Outcome} from 'components/content/Outcome';
import {HStack} from 'components/core';
import React from 'react';
import {ActivityIndicator} from 'react-native';
import {TabNavigationProps} from 'routes';
import * as Sentry from 'sentry-expo';
import {isNotFound, NotFound as NotFoundType} from 'types/requests';

export const QueryState: React.FunctionComponent<{results: UseQueryResult[]}> = ({results}) => {
  const errors = results.filter(result => result.isError).map(result => result.error as Error);
  if (errors.length > 0) {
    errors.forEach(error => {
      Sentry.Native.captureException(error);
    });
    return <InternalError />;
  }

  if (results.map(result => result.isLoading).reduce((accumulator, value) => accumulator || value)) {
    return <Loading />;
  }

  if (results.map(isResultNotFound).reduce((accumulator, value) => accumulator || value)) {
    const what = results.filter(isResultNotFound).map(result => result.data as NotFoundType);
    return <NotFound what={what} />;
  }

  Sentry.Native.captureException(new Error(`QueryState called with a set of queries that were loaded and had no errors: ${JSON.stringify(results)}`));
  return <InternalError />;
};

const isResultNotFound = (result: UseQueryResult): boolean => result.isSuccess && isNotFound(result.data);

export const InternalError: React.FunctionComponent = () => {
  const navigation = useNavigation<TabNavigationProps>();
  return (
    <Outcome
      outcome={'Oops, something went wrong!'}
      reason={"We're sorry, but we cannot complete your request at this time."}
      illustration={<ErrorIllustration />}
      onClose={() => navigation.navigate('Home')}
    />
  );
};

export const Loading: React.FunctionComponent = () => {
  return (
    <HStack width={'100%'} space={8} style={{flex: 1}} justifyContent={'center'} alignItems={'center'}>
      <ActivityIndicator />
    </HStack>
  );
};

export const NotFound: React.FunctionComponent<{what?: NotFoundType[]}> = ({what}) => {
  const thing = what[0]?.notFound ? what[0].notFound : 'requested resource';
  const navigation = useNavigation<TabNavigationProps>();
  return <Outcome outcome={'No results found'} reason={`We could not find the ${thing}.`} illustration={<NoSearchResult />} onClose={() => navigation.navigate('Home')} />;
};

export const ConnectionLost: React.FunctionComponent = () => {
  const navigation = useNavigation<TabNavigationProps>();
  const [loading, setLoading] = React.useState<boolean>(false);
  React.useEffect(() => {
    if (loading) {
      setTimeout(() => setLoading(false), 750);
    }
  }, [loading]);

  if (loading) {
    return <Loading />;
  } else {
    return (
      <Outcome
        outcome={'Connection lost!'}
        reason={'Something went wrong, please try again.'}
        illustration={<NoGPS />}
        onRetry={() => setLoading(true)}
        onClose={() => navigation.navigate('Home')}
      />
    );
  }
};

// incompleteQueryState checks to see if any of the queries are not yet complete - if so, render a <QueryState/>.
export const incompleteQueryState = (...results: UseQueryResult[]): boolean => {
  return results
    .map(result => [result.isError, result.isLoading, isResultNotFound(result)])
    .flat()
    .reduce((accumulator, value) => accumulator || value);
};
