import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { ageOn, MIN_AGE, parseBirthDate } from '@/features/onboarding/birthdate';
import { StepHeader } from '@/features/onboarding/StepHeader';
import { useProfile, useUpdateProfile } from '@/features/profile/queries';
import { useTheme } from '@/theme/ThemeProvider';

function BirthdayForm({ initial }: { initial: string | null }) {
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateProfile();
  const [y0, m0, d0] = initial ? initial.split('-') : ['', '', ''];
  const [month, setMonth] = useState(m0 ?? '');
  const [day, setDay] = useState(d0 ?? '');
  const [year, setYear] = useState(y0 ?? '');
  const [touched, setTouched] = useState(false);

  const date = parseBirthDate(month, day, year);
  const age = date ? ageOn(date, new Date()) : null;
  const error = !date
    ? 'Enter a full date.'
    : age != null && age < MIN_AGE
      ? `You must be at least ${MIN_AGE} to use APPNAME.`
      : age != null && age > 120
        ? 'Check the year.'
        : null;

  const onNext = async () => {
    setTouched(true);
    if (error || !date) return;
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
    try {
      await update.mutateAsync({ birth_date: iso });
      router.push('/(onboarding)/past-games');
    } catch {
      // surfaced below
    }
  };

  return (
    <FormScreen>
      <Button
        title="Back"
        variant="ghost"
        small
        onPress={() => router.back()}
        style={{ alignSelf: 'flex-start', marginBottom: theme.spacing.md }}
      />
      <StepHeader
        step={4}
        title="Your birthday"
        subtitle="APPNAME is for fans 13 and up. We never show your birthday to anyone."
      />
      {update.error ? <Notice tone="error">{errorMessage(update.error)}</Notice> : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <TextField
          label="Month"
          value={month}
          onChangeText={(t) => setMonth(t.replace(/\D/g, '').slice(0, 2))}
          keyboardType="number-pad"
          placeholder="MM"
          maxLength={2}
          containerStyle={{ flex: 1 }}
          autoFocus
        />
        <TextField
          label="Day"
          value={day}
          onChangeText={(t) => setDay(t.replace(/\D/g, '').slice(0, 2))}
          keyboardType="number-pad"
          placeholder="DD"
          maxLength={2}
          containerStyle={{ flex: 1 }}
        />
        <TextField
          label="Year"
          value={year}
          onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          placeholder="YYYY"
          maxLength={4}
          containerStyle={{ flex: 1.4 }}
        />
      </View>
      {touched && error ? (
        <Text variant="caption" color="red" style={{ marginBottom: theme.spacing.md }}>
          {error}
        </Text>
      ) : null}
      <Button
        title="Next"
        onPress={onNext}
        loading={update.isPending}
        disabled={touched && !!error}
      />
    </FormScreen>
  );
}

export default function BirthdayStep() {
  const profile = useProfile();
  if (!profile.data) return <Loading />;
  return <BirthdayForm initial={profile.data.birth_date} />;
}
