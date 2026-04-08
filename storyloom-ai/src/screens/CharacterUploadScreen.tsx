import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { StoryStackParamList, WizardData } from '../navigation/MainStack';
import { validateImageFile, detectFaceInImage } from '../utils/imageHelpers';
import api from '../services/api';
import { useStoryStore } from '../store/storyStore';

// ── Types ─────────────────────────────────────────────────────

type Nav   = StackNavigationProp<StoryStackParamList, 'CharacterUpload'>;
type Route = RouteProp<StoryStackParamList, 'CharacterUpload'>;

type FaceState = 'idle' | 'checking' | 'ok' | 'error';

interface CharacterDraft {
  photoUri:   string | null;
  faceState:  FaceState;
  name:       string;
  traitInput: string;
  traits:     string[];
}

const EMPTY_CHAR = (): CharacterDraft => ({
  photoUri:   null,
  faceState:  'idle',
  name:       '',
  traitInput: '',
  traits:     [],
});

const MAX_TRAITS = 3;
const MAX_NAME   = 20;

// ── Screen ────────────────────────────────────────────────────

export default function CharacterUploadScreen() {
  const { t }       = useTranslation();
  const navigation  = useNavigation<Nav>();
  const route       = useRoute<Route>();
  const wizard: WizardData = route.params;

  const setActiveStory = useStoryStore((s) => s.setActiveStory);

  const [chars, setChars]       = useState<[CharacterDraft, CharacterDraft]>([EMPTY_CHAR(), EMPTY_CHAR()]);
  const [submitting, setSubmitting] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────

  function patchChar(idx: 0 | 1, patch: Partial<CharacterDraft>) {
    setChars((prev) => {
      const next: [CharacterDraft, CharacterDraft] = [{ ...prev[0] }, { ...prev[1] }];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  // ── Photo picking ─────────────────────────────────────────────

  const pickPhoto = useCallback(async (idx: 0 | 1, source: 'camera' | 'library') => {
    // Request permission
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera access is needed to take a photo.');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Photo library access is needed.');
        return;
      }
    }

    const pickerOptions = { mediaTypes: ['images'] as ImagePicker.MediaType[], allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.85 };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || !result.assets.length) return;

    const asset = result.assets[0];

    // Basic file validation
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const fileSize = asset.fileSize ?? 0;
    const { valid, error } = validateImageFile(fileSize, mimeType);
    if (!valid) {
      Alert.alert('Invalid photo', t(`errors.${error}`));
      return;
    }

    // Set photo and start face check
    patchChar(idx, { photoUri: asset.uri, faceState: 'checking', traits: chars[idx].traits });

    try {
      const hasFace = await detectFaceInImage(asset.uri);
      if (hasFace) {
        patchChar(idx, { faceState: 'ok' });
      } else {
        patchChar(idx, { photoUri: null, faceState: 'error' });
        Alert.alert('No face detected', t('errors.upload_face'));
      }
    } catch {
      patchChar(idx, { photoUri: null, faceState: 'error' });
      Alert.alert('Validation failed', t('errors.generic'));
    }
  }, [chars, t]);

  function showPhotoPicker(idx: 0 | 1) {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 1) pickPhoto(idx, 'camera');
          if (buttonIndex === 2) pickPhoto(idx, 'library');
        }
      );
    } else {
      // Android: simple alert as fallback (can be replaced with a native sheet)
      Alert.alert('Select photo', '', [
        { text: 'Take Photo',          onPress: () => pickPhoto(idx, 'camera') },
        { text: 'Choose from Library', onPress: () => pickPhoto(idx, 'library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  // ── Traits ────────────────────────────────────────────────────

  function addTrait(idx: 0 | 1) {
    const raw = chars[idx].traitInput.trim();
    if (!raw) return;
    if (chars[idx].traits.length >= MAX_TRAITS) return;
    if (chars[idx].traits.some((t) => t.toLowerCase() === raw.toLowerCase())) return;
    patchChar(idx, { traits: [...chars[idx].traits, raw], traitInput: '' });
  }

  function removeTrait(idx: 0 | 1, traitIdx: number) {
    const next = chars[idx].traits.filter((_, i) => i !== traitIdx);
    patchChar(idx, { traits: next });
  }

  // ── Submit ────────────────────────────────────────────────────

  const canSubmit =
    !submitting &&
    chars[0].faceState === 'ok' && chars[0].name.trim().length > 0 &&
    chars[1].faceState === 'ok' && chars[1].name.trim().length > 0;

  async function handleStartStory() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Build multipart form — photos travel alongside wizard data
      const formData = new FormData();

      // Wizard fields
      formData.append('genre',     wizard.genre);
      formData.append('setting',   wizard.setting);
      formData.append('tone',      wizard.tone);
      formData.append('length',    wizard.length);
      formData.append('art_style', wizard.art_style);

      // Character metadata
      formData.append('main_name',          chars[0].name.trim());
      formData.append('main_traits',        JSON.stringify(chars[0].traits));
      formData.append('secondary_name',     chars[1].name.trim());
      formData.append('secondary_traits',   JSON.stringify(chars[1].traits));

      // Photo files — React Native FormData accepts { uri, type, name }
      formData.append('main_photo', {
        uri:  chars[0].photoUri!,
        type: 'image/jpeg',
        name: 'main.jpg',
      } as unknown as Blob);
      formData.append('secondary_photo', {
        uri:  chars[1].photoUri!,
        type: 'image/jpeg',
        name: 'secondary.jpg',
      } as unknown as Blob);

      const { data } = await api.post('/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setActiveStory(data.story);
      navigation.navigate('LoadingScene', { storyId: data.story.id });
    } catch (err: any) {
      const message = err?.response?.data?.error ?? t('errors.generic');
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render a single character card ───────────────────────────

  function renderCard(idx: 0 | 1) {
    const char   = chars[idx];
    const isMain = idx === 0;
    const label  = isMain ? t('characters.upload_main') : t('characters.upload_secondary');

    return (
      <View key={idx} style={styles.card}>
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={[styles.rolePill, isMain && styles.rolePillMain]}>
            <Text style={[styles.rolePillText, isMain && styles.rolePillTextMain]}>
              {isMain ? 'Main' : 'Secondary'}
            </Text>
          </View>
        </View>

        {/* Photo slot */}
        <TouchableOpacity
          style={[
            styles.photoSlot,
            char.faceState === 'ok'    && styles.photoSlotOk,
            char.faceState === 'error' && styles.photoSlotError,
          ]}
          onPress={() => showPhotoPicker(idx)}
          activeOpacity={0.8}
          disabled={char.faceState === 'checking'}
        >
          {char.photoUri ? (
            <>
              <Image source={{ uri: char.photoUri }} style={styles.photoImage} />
              {char.faceState === 'checking' && (
                <View style={styles.photoOverlay}>
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={styles.checkingText}>Checking photo…</Text>
                </View>
              )}
              {char.faceState === 'ok' && (
                <View style={styles.faceOkBadge}>
                  <Text style={styles.faceOkText}>✓</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderIcon}>
                {char.faceState === 'error' ? '⚠️' : '📷'}
              </Text>
              <Text style={styles.photoPlaceholderText}>
                {char.faceState === 'error' ? 'No face detected\nTap to retry' : label}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Name input */}
        <TextInput
          style={styles.nameInput}
          placeholder={t('characters.name_placeholder')}
          placeholderTextColor="#A0AEBA"
          value={char.name}
          onChangeText={(v) => patchChar(idx, { name: v.slice(0, MAX_NAME) })}
          maxLength={MAX_NAME}
          returnKeyType="done"
        />
        <Text style={styles.nameCounter}>{char.name.length}/{MAX_NAME}</Text>

        {/* Traits */}
        <View style={styles.traitsSection}>
          {char.traits.length > 0 && (
            <View style={styles.traitChips}>
              {char.traits.map((trait, ti) => (
                <TouchableOpacity
                  key={ti}
                  style={styles.traitChip}
                  onPress={() => removeTrait(idx, ti)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.traitChipText}>{trait}</Text>
                  <Text style={styles.traitChipRemove}>×</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {char.traits.length < MAX_TRAITS && (
            <View style={styles.traitRow}>
              <TextInput
                style={styles.traitInput}
                placeholder={char.traits.length === 0 ? t('characters.traits_placeholder') : 'Add another trait…'}
                placeholderTextColor="#A0AEBA"
                value={char.traitInput}
                onChangeText={(v) => patchChar(idx, { traitInput: v })}
                onSubmitEditing={() => addTrait(idx)}
                maxLength={20}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addTraitBtn, !char.traitInput.trim() && styles.addTraitBtnDisabled]}
                onPress={() => addTrait(idx)}
                disabled={!char.traitInput.trim()}
              >
                <Text style={styles.addTraitBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          )}

          {char.traits.length >= MAX_TRAITS && (
            <Text style={styles.traitsMaxNote}>Max 3 traits</Text>
          )}
        </View>
      </View>
    );
  }

  // ── UI ────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>👥 Characters</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Sub-header */}
      <Text style={styles.subHeader}>Upload a photo for each character</Text>

      {/* Cards */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderCard(0)}
        {renderCard(1)}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startButton, !canSubmit && styles.startButtonDisabled]}
          onPress={handleStartStory}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startButtonText}>Start Story →</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 8,
  },
  backText: {
    fontSize: 22,
    color: '#2E4057',
    width: 32,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E4057',
  },
  subHeader: {
    fontSize: 14,
    color: '#6B7C93',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 24,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 16,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#2E4057',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#F0F4F8',
  },
  rolePillMain: {
    backgroundColor: '#E6F5F4',
  },
  rolePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7C93',
  },
  rolePillTextMain: {
    color: '#048A81',
  },

  // Photo slot
  photoSlot: {
    height: 180,
    borderRadius: 14,
    backgroundColor: '#F0F4F8',
    borderWidth: 2,
    borderColor: 'transparent',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSlotOk: {
    borderStyle: 'solid',
    borderColor: '#048A81',
  },
  photoSlotError: {
    borderStyle: 'solid',
    borderColor: '#E0533A',
    backgroundColor: '#FFF4F2',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  checkingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  faceOkBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#048A81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  photoPlaceholder: {
    alignItems: 'center',
    gap: 8,
  },
  photoPlaceholderIcon: {
    fontSize: 36,
  },
  photoPlaceholderText: {
    fontSize: 14,
    color: '#6B7C93',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Name input
  nameInput: {
    borderWidth: 1.5,
    borderColor: '#DCE4EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: '#2E4057',
    backgroundColor: '#FAFAFA',
  },
  nameCounter: {
    fontSize: 11,
    color: '#A0AEBA',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 10,
  },

  // Traits
  traitsSection: {
    gap: 8,
  },
  traitChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  traitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F5F4',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  traitChipText: {
    fontSize: 13,
    color: '#048A81',
    fontWeight: '600',
  },
  traitChipRemove: {
    fontSize: 15,
    color: '#048A81',
    lineHeight: 16,
  },
  traitRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  traitInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#DCE4EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#2E4057',
    backgroundColor: '#FAFAFA',
  },
  addTraitBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#048A81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTraitBtnDisabled: {
    backgroundColor: '#C8D8DC',
  },
  addTraitBtnText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '600',
  },
  traitsMaxNote: {
    fontSize: 12,
    color: '#A0AEBA',
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  startButton: {
    backgroundColor: '#048A81',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#C8D8DC',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
