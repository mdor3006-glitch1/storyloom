import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [prefix, 'storyloom://'],
  config: {
    screens: {
      Main: {
        screens: {
          Home: 'home',
          Story: 'story/:id',
        },
      },
      Auth: {
        screens: {
          Splash: 'splash',
          Auth: 'auth',
          Onboarding: 'onboarding',
        },
      },
    },
  },
};
