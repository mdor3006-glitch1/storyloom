import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { truncateFreeTextInput } from '../utils/safetyHelpers';

interface Props {
  value: string;
  onChange: (val: string) => void;
  suggestions?: string[];
  onSubmit: (val: string) => void;
  disabled?: boolean;
}

export default function TextInputWithSuggestions({
  value,
  onChange,
  suggestions = [],
  onSubmit,
  disabled = false,
}: Props) {
  const { t } = useTranslation();

  const handleChange = (text: string) => {
    onChange(truncateFreeTextInput(text));
  };

  return (
    <View style={styles.container}>
      {suggestions.length > 0 && (
        <FlatList
          horizontal
          data={suggestions}
          keyExtractor={(item) => item}
          style={styles.suggestions}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chip}
              onPress={() => onChange(item)}
            >
              <Text style={styles.chipText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          placeholder={t('scene.your_input')}
          placeholderTextColor="#A0AEBA"
          maxLength={40}
          editable={!disabled}
          returnKeyType="send"
          onSubmitEditing={() => value.trim() && onSubmit(value.trim())}
        />
        <TouchableOpacity
          style={[styles.sendButton, !value.trim() && styles.sendDisabled]}
          disabled={!value.trim() || disabled}
          onPress={() => onSubmit(value.trim())}
        >
          <Text style={styles.sendText}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  suggestions: { marginBottom: 8 },
  chip: {
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipText: { fontSize: 13, color: '#2E4057' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F4F8',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#2E4057' },
  sendButton: {
    paddingLeft: 8,
    paddingVertical: 12,
  },
  sendDisabled: { opacity: 0.3 },
  sendText: { fontSize: 20, color: '#048A81' },
});
