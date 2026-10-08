import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, EmptyState, ErrorState, LoadingState } from '../../components/AsyncState';
import { FormField } from '../../components/FormField';
import type { ChecklistRepository } from '../../contracts/repositories';
import { calculateChecklistProgress } from '../../domain/checklist-progress';
import { useOptionalAppDependencies } from '../bootstrap/BootstrapGate';
import { ChecklistItemRow } from './ChecklistItemRow';
import { useChecklist } from './useChecklist';

interface ChecklistSectionProps {
  tripId: number;
  repository?: ChecklistRepository;
  refreshSignal?: number;
}

export function ChecklistSection({ tripId, repository: repositoryOverride, refreshSignal = 0 }: ChecklistSectionProps) {
  const dependencies = useOptionalAppDependencies();
  const repository = repositoryOverride ?? dependencies?.checklistRepository;
  if (!repository) throw new Error('ChecklistRepository is unavailable before bootstrap is ready');

  return <ChecklistForTrip key={`${tripId}:${refreshSignal}`} tripId={tripId} repository={repository} />;
}

function ChecklistForTrip({ tripId, repository }: { tripId: number; repository: ChecklistRepository }) {
  const checklist = useChecklist(repository, tripId);
  if (checklist.state.status === 'loading') {
    return <LoadingState message="正在加载准备事项" />;
  }
  if (checklist.state.status === 'read-error') {
    return <ErrorState message="读取准备事项失败，请重试" onRetry={checklist.retryRead} />;
  }

  const refreshFailed = checklist.state.status === 'refresh-error';
  const items = checklist.state.status === 'ready' ? checklist.state.items : [];
  const progress = calculateChecklistProgress(items);
  const mutationActive = checklist.mutationBusy !== undefined;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>准备事项</Text>
      {refreshFailed ? (
        <ErrorState
          message={checklist.state.status === 'refresh-error' ? checklist.state.message : '列表刷新失败，请重试'}
          retryLabel="重新读取"
          onRetry={checklist.retryRead}
        />
      ) : items.length === 0 ? (
        <EmptyState message="还没有准备事项" />
      ) : (
        <>
          {progress ? <Text style={styles.progress}>{progress.label}</Text> : null}
          <View accessibilityRole="list" style={styles.list}>
            {items.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                toggleBusy={checklist.mutationBusy?.kind === 'toggle' && checklist.mutationBusy.itemId === item.id}
                deleteBusy={checklist.mutationBusy?.kind === 'delete' && checklist.mutationBusy.itemId === item.id}
                disabled={mutationActive}
                onSetCompleted={(completed) => checklist.setCompleted(item.id, completed)}
                onDelete={() => checklist.remove(item.id)}
              />
            ))}
          </View>
          {checklist.mutationError ? (
            <View style={styles.mutationError}>
              <Text accessibilityRole="alert" style={styles.error}>
                {checklist.mutationError.kind === 'delete' ? '删除事项失败，请重试' : '更新事项失败，请重试'}
              </Text>
              <ActionButton
                label={checklist.mutationError.kind === 'delete' ? '重试删除事项' : '重试更新状态'}
                onPress={checklist.retryMutation}
              />
            </View>
          ) : null}
        </>
      )}
      <View style={styles.form}>
        <FormField
          label="事项名称"
          value={checklist.title}
          onChangeText={checklist.setTitle}
          error={checklist.titleError}
          disabled={checklist.saving || refreshFailed || mutationActive}
        />
        {checklist.addError ? (
          <Text accessibilityRole="alert" style={styles.error}>{checklist.addError}</Text>
        ) : null}
        <ActionButton
          label="添加事项"
          busyLabel="正在添加"
          busy={checklist.saving}
          disabled={refreshFailed || mutationActive}
          onPress={checklist.add}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: 16, gap: 12, backgroundColor: '#FFFFFF' },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: '#111111' },
  list: { gap: 8 },
  progress: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#174D78' },
  mutationError: { gap: 8 },
  form: { gap: 10 },
  error: { color: '#8A1C1C', fontSize: 14, lineHeight: 20 },
});
