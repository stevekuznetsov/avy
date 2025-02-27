import React from 'react';

import {formatDistanceToNow, isAfter} from 'date-fns';

import {useNavigation} from '@react-navigation/native';
import {Card} from 'components/content/Card';
import {Carousel, images} from 'components/content/carousel';
import {incompleteQueryState, QueryState} from 'components/content/QueryState';
import {HStack, VStack} from 'components/core';
import {AllCapsSm, AllCapsSmBlack, BodyBlack, Title3Black} from 'components/text';
import {HTML} from 'components/text/HTML';
import {useRefresh} from 'hooks/useRefresh';
import {useSynopsis} from 'hooks/useSynopsis';
import {RefreshControl, ScrollView} from 'react-native';
import Toast from 'react-native-toast-message';
import {HomeStackNavigationProps} from 'routes';
import {colorLookup} from 'theme';
import {AvalancheCenter, AvalancheCenterID} from 'types/nationalAvalancheCenter';
import {RequestedTime, utcDateToLocalTimeString} from 'utils/date';

interface SynopsisTabProps {
  center_id: AvalancheCenterID;
  center: AvalancheCenter;
  requestedTime: RequestedTime;
  forecast_zone_id: number;
}

export const SynopsisTab: React.FunctionComponent<SynopsisTabProps> = ({center_id, center, forecast_zone_id, requestedTime}) => {
  const synopsisResult = useSynopsis(center_id, forecast_zone_id, requestedTime);
  const synopsis = synopsisResult.data;
  const {isRefreshing, refresh} = useRefresh(synopsisResult.refetch);

  const navigation = useNavigation<HomeStackNavigationProps>();
  React.useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      Toast.hide();
    });
  }, [navigation]);

  React.useEffect(() => {
    if (synopsis?.expires_time) {
      const expires_time = new Date(synopsis.expires_time);
      if (isAfter(new Date(), expires_time)) {
        Toast.show({
          type: 'error',
          text1: `This blog expired ${formatDistanceToNow(expires_time)} ago.`,
          autoHide: false,
          position: 'bottom',
          onPress: () => Toast.hide(),
        });
      }
    }
  }, [synopsis]);

  if (incompleteQueryState(synopsisResult) || !synopsis) {
    return <QueryState results={[synopsisResult]} />;
  }

  const imageItems = images(synopsis.media);

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh} />}>
      <VStack space={8} backgroundColor={colorLookup('background.base')}>
        <Card borderRadius={0} borderColor="white" header={<Title3Black>{center.config.blog_title ?? 'Conditions Blog'}</Title3Black>}>
          <HStack justifyContent="space-evenly" space={8}>
            <VStack space={8} style={{flex: 1}}>
              <AllCapsSmBlack>Issued</AllCapsSmBlack>
              <AllCapsSm style={{textTransform: 'none'}} color="text.secondary">
                {utcDateToLocalTimeString(synopsis.published_time)}
              </AllCapsSm>
            </VStack>
            {synopsis.expires_time && (
              <VStack space={8} style={{flex: 1}}>
                <AllCapsSmBlack>Expires</AllCapsSmBlack>
                <AllCapsSm style={{textTransform: 'none'}} color="text.secondary">
                  {utcDateToLocalTimeString(synopsis.expires_time)}
                </AllCapsSm>
              </VStack>
            )}
            <VStack space={8} style={{flex: 1}}>
              <AllCapsSmBlack>Author</AllCapsSmBlack>
              <AllCapsSm style={{textTransform: 'none'}} color="text.secondary">
                {synopsis.author || 'Unknown'}
                {'\n'}
              </AllCapsSm>
            </VStack>
          </HStack>
        </Card>
        {synopsis.hazard_discussion && (
          <Card borderRadius={0} borderColor="white" header={<BodyBlack>{synopsis.bottom_line}</BodyBlack>}>
            <HTML source={{html: synopsis.hazard_discussion}} />
            {imageItems && <Carousel thumbnailHeight={160} thumbnailAspectRatio={1.3} media={imageItems} displayCaptions={false} />}
          </Card>
        )}
      </VStack>
    </ScrollView>
  );
};
