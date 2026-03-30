import { StatusBar } from 'expo-status-bar';
import { StyleSheet, SafeAreaView } from 'react-native';
import DriverHomeScreen from './src/screens/DriverHomeScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <DriverHomeScreen />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
