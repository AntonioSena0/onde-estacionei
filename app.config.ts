import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Onde Estacionei?',
  slug: 'onde-estacionei',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'ondeestacionei',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.meiofio.ondeestacionei',
  },
  android: {
    package: 'com.meiofio.ondeestacionei',
    adaptiveIcon: {
      backgroundColor: '#1D4FA8',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'],
  },
  plugins: [
    'expo-router',
    '@maplibre/maplibre-react-native',
    'expo-dev-client',
    ['expo-sqlite', { useSQLCipher: true }],
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#1D4FA8',
        image: './assets/images/splash-icon.png',
        imageWidth: 160,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'O app usa sua localização para marcar onde o carro ficou e traçar a volta a pé.',
      },
    ],
    ['expo-sensors', { motionPermission: 'O app usa o barômetro para estimar em que andar o carro ficou.' }],
    ['expo-notifications', { color: '#1D4FA8', icon: './assets/images/icons/notification-icon.png' }],
    [
      'react-native-android-widget',
      {
        widgets: [
          {
            name: 'ParkingSpot',
            label: 'Onde Estacionei?',
            description: 'Distância até o carro e tempo do parquímetro',
            previewImage: './assets/images/widget-preview.png',
            minWidth: '300dp',
            minHeight: '180dp',
            targetCellWidth: 5,
            targetCellHeight: 3,
            resizeMode: 'horizontal|vertical',
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
