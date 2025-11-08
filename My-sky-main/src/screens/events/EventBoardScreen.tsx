import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { DiscoverStackParamList } from '../../navigation/types';
import { theme } from '../../styles/theme';
import EventBoardContent from './EventBoardContent';

type EventBoardRouteProp = RouteProp<DiscoverStackParamList, 'EventBoard'>;

const EventBoardScreen: React.FC = () => {
  const route = useRoute<EventBoardRouteProp>();
  const { eventId, eventName } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <EventBoardContent eventId={eventId} eventName={eventName} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
});

export default EventBoardScreen; 