import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home Page', () => {
  it('should render the title', () => {
    render(<Home />);
    const title = screen.getByText('RUM Incident Logger');
    expect(title).toBeInTheDocument();
  });

  it('should display progress messages', () => {
    render(<Home />);
    const progress = screen.getByText('Initializing...');
    expect(progress).toBeInTheDocument();
  });
});