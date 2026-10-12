import { registerRootComponent } from 'expo';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import ExpoTripNative from '../../../modules/expo-trip-native';

const PASS_MARKER = 'TRIP_COUNTDOWN_SQLITE_CONTRACT_PASS';
const FAIL_MARKER = 'TRIP_COUNTDOWN_SQLITE_CONTRACT_FAIL';

function SqliteContractApp() {
  const [status, setStatus] = useState('正在执行真实 SQLite 契约');

  useEffect(() => {
    void (async () => {
      if (!ExpoTripNative) {
        throw new Error('ExpoTripNative is unavailable');
      }

      console.log(
        'TRIP_COUNTDOWN_RUNTIME_CAPABILITIES',
        JSON.stringify({ intlSegmenter: typeof Intl.Segmenter }),
      );
      const prepared = await ExpoTripNative.preparePrivateStorage();
      const { runExpoSqliteContract } = await import('./run-sqlite-contract');
      const evidence = await runExpoSqliteContract(prepared.directory);
      console.log(PASS_MARKER, JSON.stringify(evidence));
      setStatus('真实 SQLite 契约通过');
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(FAIL_MARKER, message);
      setStatus('真实 SQLite 契约失败');
    });
  }, []);

  return (
    <View>
      <Text>{status}</Text>
    </View>
  );
}

registerRootComponent(SqliteContractApp);
