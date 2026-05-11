import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import FavouritesScreen from '../screens/FavouritesScreen';
import CreditsScreen from '../screens/CreditsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StorySetupWizardScreen from '../screens/StorySetupWizardScreen';
import CharacterUploadScreen from '../screens/CharacterUploadScreen';
import CartoonCharacterPickerScreen from '../screens/CartoonCharacterPickerScreen';
import StoryElementsPickerScreen from '../screens/StoryElementsPickerScreen';
import SceneScreen from '../screens/SceneScreen';
import LoadingSceneScreen from '../screens/LoadingSceneScreen';
import EndingScreen from '../screens/EndingScreen';
import { colors } from '../theme/colors';
import { HapticService } from '../services/HapticService';
import GlassView from '../components/GlassView';

export type MainTabParamList = {
  Home: undefined;
  Favourites: undefined;
  Credits: undefined;
  Profile: undefined;
};

export type WizardData = {
  genre: string;
  genre_subtype?: string;
  setting: string;
  tone: string;
  length: 'short' | 'medium' | 'long';
  art_style: string;
  story_elements?: string[];
  // Pre-filled character data (from CartoonCharacterPicker)
  main_name?: string;
  secondary_name?: string;
  main_appearance?: string;
  secondary_appearance?: string;
};

export type StoryStackParamList = {
  Tabs: undefined;
  StorySetupWizard: undefined;
  StoryElementsPicker: WizardData;
  CartoonCharacterPicker: WizardData;
  CharacterUpload: WizardData;
  LoadingScene: {
    storyId: string;
    playerChoice?: string;
    playerTextInput?: string;
    reason?: 'first_scene' | 'stall_overflow';
  };
  Scene: { storyId: string; sceneNumber: number };
  Ending: { storyId: string };
};

// ── Tab bar ──────────────────────────────────────────────────
const TAB_ITEMS = [
  { name: 'Home',       icon: '🏠', label: 'Home'    },
  { name: 'Favourites', icon: '⭐', label: 'Favs'    },
  { name: 'Credits',    icon: '◆',  label: 'Credits' },
  { name: 'Profile',    icon: '👤', label: 'Profile' },
];

function WiiTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const pressAnims = useRef(TAB_ITEMS.map(() => new Animated.Value(1))).current;

  function handlePress(index: number, routeName: string, isFocused: boolean) {
    HapticService.tabPress();
    Animated.sequence([
      Animated.timing(pressAnims[index], { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(pressAnims[index], { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    if (!isFocused) navigation.navigate(routeName);
  }

  return (
    <GlassView
      intensity={60}
      tint="dark"
      androidFallbackColor="rgba(0,0,0,0.75)"
      style={[styles.tabBar, { paddingBottom: insets.bottom || 12 }]}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.20)' }]} />
      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const item = TAB_ITEMS[index];
          return (
            <Pressable
              key={route.key}
              onPress={() => handlePress(index, route.name, isFocused)}
              style={styles.tabPressable}
            >
              <Animated.View style={[
                styles.tabItem,
                isFocused && styles.tabItemActive,
                { transform: [{ scale: pressAnims[index] }] },
              ]}>
                <Text style={[styles.tabIcon, isFocused && styles.tabIconActive]}>{item.icon}</Text>
                <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{item.label}</Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </GlassView>
  );
}

const Tab   = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<StoryStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator tabBar={(props) => <WiiTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home"       component={HomeScreen}       />
      <Tab.Screen name="Favourites" component={FavouritesScreen} />
      <Tab.Screen name="Credits"    component={CreditsScreen}    />
      <Tab.Screen name="Profile"    component={ProfileScreen}    />
    </Tab.Navigator>
  );
}

export default function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"                   component={TabNavigator}                  />
      <Stack.Screen name="StorySetupWizard"        component={StorySetupWizardScreen}        />
      <Stack.Screen name="StoryElementsPicker"     component={StoryElementsPickerScreen}     />
      <Stack.Screen name="CartoonCharacterPicker"  component={CartoonCharacterPickerScreen}  />
      <Stack.Screen name="CharacterUpload"         component={CharacterUploadScreen}         />
      <Stack.Screen name="LoadingScene"            component={LoadingSceneScreen}            />
      <Stack.Screen name="Scene"                   component={SceneScreen}                   />
      <Stack.Screen name="Ending"                  component={EndingScreen}                  />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.15)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  tabBarInner: { flexDirection: 'row', paddingTop: 8, paddingHorizontal: 8, gap: 4 },
  tabPressable: { flex: 1, alignItems: 'center' },
  tabItem: {
    width: 60, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
    gap: 2,
  },
  tabItemActive: {
    backgroundColor: 'rgba(127,119,221,0.50)',
    shadowColor: colors.plumbob,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  tabIcon:        { fontSize: 18, opacity: 0.55 },
  tabIconActive:  { opacity: 1 },
  tabLabel:       { fontSize: 7.5, fontWeight: '500', color: colors.tabInactive },
  tabLabelActive: { color: 'rgba(255,255,255,0.90)', fontWeight: '500' },
});
