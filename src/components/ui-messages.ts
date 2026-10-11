export const UI_MESSAGES = {
  bootstrapRead: '读取失败，请重试',
  tripRead: '读取旅行失败，请重试',
  tripNotFound: '旅行不存在',
  tripSave: '保存失败，请重试',
  tripDelete: '删除未完成，请重试',
  tripSavedReminderFailed: '旅行已保存，但提醒更新失败。请在旅行详情中重试提醒。',
  checklistRead: '读取准备事项失败，请重试',
  checklistRefresh: '列表刷新失败，请重试',
  checklistAdd: '添加事项失败，请重试',
  checklistDelete: '删除事项失败，请重试',
  checklistUpdate: '更新事项失败，请重试',
  checklistSavedRefresh: '事项已保存，但列表刷新失败，请重试',
  checklistDeletedRefresh: '事项已删除，但列表刷新失败，请重试',
  checklistStatusRefresh: '事项状态已保存，但列表刷新失败，请重试',
  reminderRead: '读取提醒失败，请重试',
  reminderUpdate: '提醒更新失败，请重试',
  reminderPermissionDenied: '通知权限未开启，提醒未启用',
  reminderUnavailable: '当前无法安排提醒',
} as const;

export type SafeUiMessage = (typeof UI_MESSAGES)[keyof typeof UI_MESSAGES];
