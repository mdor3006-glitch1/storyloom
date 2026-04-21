import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

const prefix = Linking.createURL('/');

// Screen names must match the names declared in AuthStack, MainStack,
// and the OnboardingNavigator created in AppNavigator.
export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [prefix, 'storyloom://'],
  config: {
    screens: {
      // AuthStack screens
      Splash: 'splash',
      Auth: 'auth',

      // OnboardingNavigator screen
      Onboarding: 'onboarding',

      // MainStack screens
      Tabs: {
        screens: {
          Home: 'home',
          Favourites: 'favourites',
          Credits: 'credits',
          Profile: 'profile',
        },
      },
      StorySetupWizard: 'story/setup',
      LoadingScene: 'story/:storyId/loading',
      Scene: 'story/:storyId/scene/:sceneNumber',
      Ending: 'story/:storyId/ending',
    },
  },
};
