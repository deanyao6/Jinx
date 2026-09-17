import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { FormScreen } from '@/components/FormScreen';
import { Loading } from '@/components/Loading';
import { Notice, errorMessage } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { StepIntro } from '@/features/onboarding/ui/StepIntro';
import { useProfile, useUpdateProfile } from '@/features/profile/queries';
import { useTheme } from '@/theme/ThemeProvider';

function CityForm({ initialCity }: { initialCity: string }) {
  const theme = useTheme();
  const router = useRouter();
  const update = useUpdateProfile();
  const [city, setCity] = useState(initialCity);
  const [geocoding, setGeocoding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const onUseCity = async () => {
    const text = city.trim();
    if (!text) return;
    setNotice(null);
    setGeocoding(true);
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const hits = await Location.geocodeAsync(text);
      const first = hits[0];
      if (first) {
        lat = first.latitude;
        lng = first.longitude;
      }
    } catch {
      // Geocoding is best effort; the city text still saves.
    }
    try {
      await update.mutateAsync({ home_city: text, home_lat: lat, home_lng: lng });
      router.push('/(onboarding)/birthday');
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setGeocoding(false);
    }
  };

  const onSkip = async () => {
    try {
      await update.mutateAsync({ home_city: null, home_lat: null, home_lng: null });
    } catch {
      // not blocking
    }
    router.push('/(onboarding)/birthday');
  };

  return (
    <FormScreen>
      <StepIntro
        step={3}
        title="Home city"
        body="Used for miles traveled and your map. Optional."
        onBack={() => router.back()}
      />
      {notice ? <Notice tone="error">{notice}</Notice> : null}
      <TextField
        label="City"
        value={city}
        onChangeText={setCity}
        placeholder="Philadelphia, PA"
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={onUseCity}
        hint="We only look up the city you type. Your device location is never stored."
      />
      <View style={{ gap: theme.spacing.sm }}>
        <Button
          title="Use my city"
          onPress={onUseCity}
          disabled={!city.trim()}
          loading={geocoding || update.isPending}
        />
        <Button title="Skip for now" variant="ghost" onPress={onSkip} disabled={geocoding} />
      </View>
    </FormScreen>
  );
}

export default function CityStep() {
  const profile = useProfile();
  if (!profile.data) return <Loading />;
  return <CityForm initialCity={profile.data.home_city ?? ''} />;
}
