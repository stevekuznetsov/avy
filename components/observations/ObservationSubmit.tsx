import {HStack, View, VStack} from 'components/core';
import {Body, BodySemibold, Title3Black, Title3Semibold} from 'components/text';
import React, {useCallback} from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';
import {AvalancheCenterID} from 'types/nationalAvalancheCenter';
import {useNavigation} from '@react-navigation/native';
import {ObservationsStackNavigationProps} from 'routes';
import {Keyboard, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback} from 'react-native';
import {colorLookup} from 'theme';
import {AntDesign} from '@expo/vector-icons';
import {createObservation, observationSchema} from 'components/observations/ObservationSchema';
import {Button} from 'components/content/Button';
import {TextField} from 'components/form/TextField';
import {useAvalancheCenterMetadata} from 'hooks/useAvalancheCenterMetadata';
import {SelectField} from 'components/form/SelectField';
import {uniq} from 'lodash';
import {useForm, FormProvider} from 'react-hook-form';
import {yupResolver} from '@hookform/resolvers/yup';
import {useBackHandler} from '@react-native-community/hooks';
import {LocationField} from 'components/form/LocationField';
import {CollapsibleCard} from 'components/content/Card';
import {DateField} from 'components/form/DateField';
import {SwitchField} from 'components/form/SwitchField';
import {Conditional} from 'components/form/Conditional';

export const ObservationSubmit: React.FC<{
  center_id: AvalancheCenterID;
  onClose?: () => void;
}> = ({center_id, onClose}) => {
  const {data: center} = useAvalancheCenterMetadata(center_id);
  const zones = uniq(center?.zones?.filter(z => z.status === 'active')?.map(z => z.name));

  const navigation = useNavigation<ObservationsStackNavigationProps>();
  const formContext = useForm({
    defaultValues: createObservation(),
    resolver: yupResolver(observationSchema),
    mode: 'onBlur',
    shouldFocusError: false,
    shouldUnregister: true,
  });

  const onSubmitHandler = data => {
    console.log('onSubmitHandler -> success', {data});
  };
  const onSubmitErrorHandler = data => {
    console.log('onSubmitErrorHandler -> error', {data});
  };

  const onCloseHandler = useCallback(() => {
    formContext.reset();
    onClose ? onClose() : navigation.goBack();
  }, [formContext, navigation, onClose]);

  useBackHandler(() => {
    onCloseHandler();
    // Returning true marks the event as processed
    return true;
  });

  return (
    <FormProvider {...formContext}>
      <View width="100%" height="100%" bg="#F6F8FC">
        {/* SafeAreaView shouldn't inset from bottom edge because TabNavigator is sitting there */}
        <SafeAreaView edges={['top', 'left', 'right']} style={{height: '100%', width: '100%'}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1, height: '100%'}}>
            <VStack style={{height: '100%', width: '100%'}} alignItems="stretch" bg="#F6F8FC">
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <HStack justifyContent="flex-start" pb={8}>
                  <AntDesign.Button
                    size={24}
                    color={colorLookup('text')}
                    name="arrowleft"
                    backgroundColor="#F6F8FC"
                    iconStyle={{marginLeft: 0, marginRight: 8}}
                    style={{textAlign: 'center'}}
                    onPress={onCloseHandler}
                  />
                  <Title3Black>Submit an observation</Title3Black>
                </HStack>
              </TouchableWithoutFeedback>
              <ScrollView style={{height: '100%', width: '100%', backgroundColor: 'white'}}>
                <VStack width="100%" justifyContent="flex-start" alignItems="stretch" space={8} pt={8} pb={8}>
                  <View px={16}>
                    <Body>Help keep the NWAC community informed by submitting your observation.</Body>
                  </View>
                  <CollapsibleCard borderRadius={0} borderColor="white" startsCollapsed={false} header={<Title3Semibold>Privacy</Title3Semibold>}>
                    <VStack space={8}>
                      <SwitchField name="visibility" label="Observation visibility" items={['Public', 'Private']} />
                      <SelectField name="photoUsage" label="Photo usage" radio items={['Use anonymously', 'Use with photo credit', "Don't use"]} />
                    </VStack>
                  </CollapsibleCard>
                  <CollapsibleCard borderRadius={0} borderColor="white" startsCollapsed={false} header={<Title3Semibold>General information</Title3Semibold>}>
                    <VStack space={8}>
                      <TextField name="name" label="Name" placeholder="Jane Doe" textContentType="name" />
                      <TextField
                        name="email"
                        label="Email address"
                        placeholder="you@domain.com"
                        textContentType="emailAddress"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <DateField name="observationDate" label="Observation date" />
                      <SelectField name="zone" label="Zone/Region" prompt="Select a zone or region" items={zones} />
                      <SelectField
                        name="activity"
                        label="Activity"
                        prompt="What were you doing?"
                        items={['Skiing/Snowboarding', 'Snowmobiling/Snowbiking', 'XC Skiing/Snowshoeing', 'Walking/Hiking', 'Driving', 'Other']}
                      />
                      <TextField
                        name="location"
                        label="Location"
                        placeholder="Please describe your observation location using common geographical place names (drainages, peak names, etc)."
                        multiline
                      />
                      <LocationField name="mapLocation" label="Latitude/Longitude" />
                      <TextField name="route" label="Route" placeholder="Enter details of route taken, including aspects and elevations observed." multiline />
                    </VStack>
                  </CollapsibleCard>
                  <CollapsibleCard borderRadius={0} borderColor="white" startsCollapsed header={<Title3Semibold>Signs of instability</Title3Semibold>}>
                    <VStack space={8}>
                      <SwitchField name="recent" label="Did you see recent avalanches?" items={['No', 'Yes']} />
                      <Conditional name="recent" value="Yes">
                        <SwitchField name="trigger" label="Did you trigger an avalanche?" items={['No', 'Yes']} />
                        <Conditional name="trigger" value="Yes">
                          <SwitchField name="caught" label="Were you caught?" items={['No', 'Yes']} pt={8} />
                        </Conditional>
                      </Conditional>
                      <SwitchField name="cracking" label="Did you experience snowpack cracking?" items={['No', 'Yes']} />
                      <Conditional name="cracking" value="Yes">
                        <SelectField name="crackingExtent" label="How widespread was the cracking?" items={['Isolated', 'Widespread']} prompt=" " />
                      </Conditional>
                      <SwitchField name="collapsing" label="Did you experience snowpack collapsing?" items={['No', 'Yes']} />
                      <Conditional name="collapsing" value="Yes">
                        <SelectField name="collapsingExtent" label="How widespread was the collapsing?" items={['Isolated', 'Widespread']} prompt=" " />
                      </Conditional>
                      <TextField
                        name="instabilityComments"
                        label="Instability comments"
                        placeholder="Note length and depth of cracking or collapsing, how recent were the observed avalanches, etc."
                        multiline
                      />
                    </VStack>
                  </CollapsibleCard>
                  <CollapsibleCard borderRadius={0} borderColor="white" startsCollapsed header={<Title3Semibold>Snowpack</Title3Semibold>}></CollapsibleCard>
                  <CollapsibleCard borderRadius={0} borderColor="white" startsCollapsed header={<Title3Semibold>Observation summary</Title3Semibold>}></CollapsibleCard>
                  <CollapsibleCard borderRadius={0} borderColor="white" startsCollapsed header={<Title3Semibold>Weather</Title3Semibold>}></CollapsibleCard>
                  <CollapsibleCard borderRadius={0} borderColor="white" startsCollapsed header={<Title3Semibold>Photos</Title3Semibold>}></CollapsibleCard>
                  <Button
                    mx={16}
                    mt={16}
                    mb={32}
                    buttonStyle="primary"
                    onPress={async () => {
                      // Force validation errors to show up on fields that haven't been visited yet
                      await formContext.trigger();
                      // Then try to submit the form
                      formContext.handleSubmit(onSubmitHandler, onSubmitErrorHandler)();
                    }}>
                    <BodySemibold>Submit your observation</BodySemibold>
                  </Button>
                </VStack>
              </ScrollView>
            </VStack>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </FormProvider>
  );
};
