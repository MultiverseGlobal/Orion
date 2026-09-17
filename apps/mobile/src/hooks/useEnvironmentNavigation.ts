import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useOrionStore } from '../store/useOrionStore';

export function useEnvironmentNavigation() {
  const { environment, back } = useOrionStore();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      // If we are in a sub-environment (e.g. TEXT_MODE, MEMORY), intercept the back button
      // and navigate back to LIVING_MODE instead of closing the app.
      if (environment !== 'LIVING_MODE') {
        back();
        return true; // Prevent default behavior
      }
      return false; // Allow default behavior (exit app)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => backHandler.remove();
  }, [environment, back]);
}
