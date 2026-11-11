import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from '@/widget/parking-widget';

registerWidgetTaskHandler(widgetTaskHandler);
