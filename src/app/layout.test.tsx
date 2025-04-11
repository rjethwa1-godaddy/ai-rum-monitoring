import { render, screen } from '@testing-library/react';
import Layout from './layout';

describe('Layout Component', () => {
  it('should render children', () => {
    render(
      <Layout>
        <div>Test Child</div>
      </Layout>
    );
    const child = screen.getByText('Test Child');
    expect(child).toBeInTheDocument();
  });
});