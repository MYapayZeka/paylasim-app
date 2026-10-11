import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import AddItemScreen from '../screens/AddItemScreen';
import RequestsScreen from '../screens/RequestsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import WebNavbar from '../components/WebNavbar';
import MobileBottomTabBar from '../components/MobileBottomTabBar';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  return (
    <Tab.Navigator
      tabBar={(props) => <MobileBottomTabBar {...props} />}
      screenOptions={{
        headerShown: isDesktop,
        header: isDesktop ? (props) => <WebNavbar {...props} /> : undefined,
      }}
    >
      <Tab.Screen name="Keşfet" component={HomeScreen} options={{ title: 'Keşfet' }} />
      <Tab.Screen name="Arama" component={SearchScreen} options={{ title: 'Arama' }} />
      <Tab.Screen name="Talepler" component={RequestsScreen} options={{ title: 'Talepler' }} />
      <Tab.Screen name="Sohbetler" component={MessagesScreen} options={{ title: 'Sohbetler' }} />
      <Tab.Screen name="Profil" component={ProfileScreen} options={{ title: 'Profil' }} />
      <Tab.Screen name="İlan Ver" component={AddItemScreen} options={{ title: 'İlan Ver' }} />
    </Tab.Navigator>
  );
}