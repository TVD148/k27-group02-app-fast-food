import React from 'react';
import { LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';

LogBox.ignoreLogs(['SafeAreaView has been deprecated']);


export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#FF8F00" />
      <AppNavigator />
    </NavigationContainer>
  );
}
