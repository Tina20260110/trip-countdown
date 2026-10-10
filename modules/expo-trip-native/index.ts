// Re-export the native module. On web, it will be resolved to ExpoTripNativeModule.web.ts
// and on native platforms to ExpoTripNativeModule.ts
export { default } from './src/ExpoTripNativeModule';
export * from './src/ExpoTripNative.types';
