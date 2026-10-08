import { cleanup } from '@testing-library/react-native';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(cleanup);
