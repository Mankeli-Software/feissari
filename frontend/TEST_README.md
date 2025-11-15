# Frontend Tests

This directory contains tests for the Feissari game frontend.

## Test Structure

```
frontend/
├── __tests__/
│   └── utils.test.ts           # Utility and setup tests
├── components/
│   └── game-screen.test.tsx    # GameScreen component tests
└── contexts/
    └── game-context.test.tsx   # Game context and state management tests
```

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Coverage

### Game Context Tests (`contexts/game-context.test.tsx`)
- ✅ Initial state rendering
- ✅ Starting a new game
- ✅ Sending messages
- ✅ Balance updates
- ✅ Game over conditions (balance depleted, time expired)
- ✅ Timer countdown
- ✅ Session management with cookies
- ✅ Error handling
- ✅ Loading states

### Game Screen Tests (`components/game-screen.test.tsx`)
- ✅ Displaying game interface
- ✅ Message input and submission
- ✅ Input clearing after send
- ✅ Disabled state when loading
- ✅ Time formatting (MM:SS)
- ✅ Low balance warnings
- ✅ Game over screen
- ✅ Play again functionality
- ✅ Error message display
- ✅ Message differentiation (AI vs user)
- ✅ Auto-scroll to new messages
- ✅ Loading indicators

### Utils Tests (`__tests__/utils.test.ts`)
- ✅ Test setup validation
- ✅ API response type validation
- ✅ Time formatting utilities
- ✅ Balance validation
- ✅ Game state management

## Testing Technologies

- **Vitest**: Fast unit test framework
- **React Testing Library**: Testing React components
- **jsdom**: Browser environment simulation
- **@testing-library/user-event**: Simulating user interactions

## Writing New Tests

### Example Component Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyComponent from './my-component';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interactions', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(<MyComponent onClick={handleClick} />);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Example Context Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyProvider, useMyContext } from './my-context';

function TestComponent() {
  const { value } = useMyContext();
  return <div>{value}</div>;
}

describe('MyContext', () => {
  it('should provide context values', () => {
    render(
      <MyProvider>
        <TestComponent />
      </MyProvider>
    );
    expect(screen.getByText('expected value')).toBeInTheDocument();
  });
});
```

## Mocking

### Mocking fetch API

```typescript
beforeEach(() => {
  global.fetch = vi.fn();
});

it('should fetch data', async () => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: 'test' }),
  });
  
  // Your test code here
});
```

### Mocking cookies

```typescript
import Cookies from 'js-cookie';

beforeEach(() => {
  vi.clearAllMocks();
  (Cookies.get as any).mockReturnValue('test-session-id');
});
```

## Best Practices

1. **Arrange-Act-Assert**: Structure tests with clear setup, action, and assertion phases
2. **One assertion per test**: Keep tests focused on a single behavior
3. **Descriptive test names**: Use clear, behavior-focused test descriptions
4. **Mock external dependencies**: Isolate component logic from API calls
5. **Use Testing Library queries**: Prefer user-centric queries (getByRole, getByText)
6. **Avoid implementation details**: Test behavior, not implementation
7. **Clean up**: Use cleanup functions to reset state between tests

## Troubleshooting

### Tests not finding components
Ensure the component files are created in the correct locations and exported properly.

### Mock not working
Check that mocks are cleared between tests using `vi.clearAllMocks()` in `beforeEach`.

### Timeout errors
For async operations, use `waitFor` or increase the timeout:
```typescript
await waitFor(() => {
  expect(screen.getByText('loaded')).toBeInTheDocument();
}, { timeout: 5000 });
```

## CI/CD Integration

Tests are designed to run in CI/CD pipelines. Ensure the following in your CI config:

```yaml
- name: Run frontend tests
  run: |
    cd frontend
    npm ci
    npm test
```

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

Run `npm run test:coverage` to generate a coverage report.
