import { render, screen } from '@testing-library/react';
import App from './App';

test('renders locker map title', () => {
  render(<App />);
  const titleElement = screen.getByText(/물품보관함 지도/i);
  expect(titleElement).toBeInTheDocument();
});
