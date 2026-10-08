import { StyleSheet, Text, View } from 'react-native';

interface TripRouteShellProps {
  title: string;
}

export function TripRouteShell({ title }: TripRouteShellProps) {
  return (
    <View style={styles.container} accessibilityLabel={title}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: '#111111',
  },
});
