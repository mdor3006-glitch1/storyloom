import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import FavouritesScreen from '../screens/FavouritesScreen';
import CreditsScreen from '../screens/CreditsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StorySetupWizardScreen from '../screens/StorySetupWizardScreen';
import CharacterUploadScreen from '../screens/CharacterUploadScreen';
import SceneScreen from '../screens/SceneScreen';
import LoadingSceneScreen from '../screens/LoadingSceneScreen';
import EndingScreen from '../screens/EndingScreen';

export type MainTabParamList = {
  Home: undefined;
  Favourites: undefined;
  Credits: undefined;
  Profile: undefined;
};

export type WizardData = {
  genre: string;
  setting: string;
  tone: string;
  length: 'short' | 'medium' | 'long';
  art_style: string;
};

export type StoryStackParamList = {
  Tabs: undefined;
  StorySetupWizard: undefined;
  CharacterUpload: WizardData;
  LoadingScene: { storyId: string; playerChoice?: string; playerTextInput?: string };
  Scene: { storyId: string; sceneNumber: number };
  Ending: { storyId: string };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<StoryStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#FAFAFA', borderTopColor: '#F0F4F8' },
        tabBarActiveTintColor: '#048A81',
        tabBarInactiveTintColor: '#2E4057',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Favourites" component={FavouritesScreen} />
      <Tab.Screen name="Credits" component={CreditsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="StorySetupWizard" component={StorySetupWizardScreen} />
      <Stack.Screen name="CharacterUpload" component={CharacterUploadScreen} />
      <Stack.Screen name="LoadingScene" component={LoadingSceneScreen} />
      <Stack.Screen name="Scene" component={SceneScreen} />
      <Stack.Screen name="Ending" component={EndingScreen} />
    </Stack.Navigator>
  );
}
