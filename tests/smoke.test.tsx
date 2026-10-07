import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

describe('engineering baseline', () => {
  it('renders a React Native component with the test environment', async () => {
    await render(<Text>工程基线已就绪</Text>);

    expect(screen.getByText('工程基线已就绪')).toBeOnTheScreen();
  });
});
