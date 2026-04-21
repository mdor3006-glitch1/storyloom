import * as Haptics from 'expo-haptics';
import { SoundService } from './SoundService';

export const HapticService = {
  choiceTap() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    SoundService.play('choiceTap', 0.6);
  },

  twistReveal() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 100);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 200);
    SoundService.play('twistSting', 0.7);
  },

  storyComplete() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    SoundService.play('storyComplete', 0.8);
  },

  creditsSpent() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    SoundService.play('creditsSpent', 0.6);
  },

  creditsEarned() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 50);
    SoundService.play('creditsEarned', 0.6);
  },

  achievementUnlock() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 200);
    SoundService.play('achievementUnlock', 0.8);
  },

  streakExtend() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    SoundService.play('streakExtend', 0.6);
  },

  error() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },

  tabPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    SoundService.play('choiceTap', 0.4);
  },

  longPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  stageTransition() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 120);
    SoundService.play('screenTransition', 0.5);
  },
};
