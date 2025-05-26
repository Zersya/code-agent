# Testing Documentation

This document describes the comprehensive testing setup for the GitLab webhook integration project.

## Testing Framework

The project uses **Bun's native testing framework** with TypeScript support. The testing setup includes:

- **Unit Tests**: Testing individual functions and services in isolation
- **Integration Tests**: Testing complete workflows and service interactions
- **Mocking**: Comprehensive mocking of external dependencies
- **Coverage Reports**: Code coverage analysis and reporting

## Test Structure

```
src/test/
├── setup/
│   └── test-setup.ts          # Global test configuration and utilities
├── unit/
│   ├── services/              # Service layer tests
│   │   ├── webhook-deduplication.test.ts
│   │   ├── notion-integration.test.ts
│   │   ├── llm.test.ts
│   │   ├── embedding.test.ts
│   │   ├── database.test.ts
│   │   ├── review.test.ts
│   │   ├── queue.test.ts
│   │   └── gitlab.test.ts
│   └── middleware/            # Middleware tests
│       └── auth.test.ts
└── integration/               # Integration tests
    └── webhook-flow.test.ts
```

## Running Tests

### Basic Commands

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage report
bun test --coverage
```

### Running Specific Tests

```bash
# Run tests for a specific service
bun test --testPathPattern=llm.test.ts

# Run tests matching a pattern
bun test --testNamePattern="should handle API errors"

# Run only unit tests
bun test src/test/unit

# Run specific test file
bun test src/test/webhook-deduplication.test.ts
```

## Test Coverage

The test suite covers the following critical areas:

### 1. Core Business Logic
- ✅ GitLab webhook processing and merge request review automation
- ✅ Sequential thinking service integration for code reviews
- ✅ Notion API integration for task context extraction
- ✅ Embedding queue system operations and file filtering
- ✅ LLM service provider switching (OpenRouter/Ollama)

### 2. Security and Infrastructure
- ✅ Authentication and session handling middleware
- ✅ Database operations for project tracking and embedding status
- ✅ Webhook duplicate request prevention mechanisms
- ✅ Error handling and retry strategies

### 3. External Integrations
- ✅ GitLab API interactions (projects, merge requests, commits)
- ✅ Notion API for task context fetching
- ✅ LLM provider APIs (OpenRouter and Ollama)
- ✅ Database operations with PostgreSQL
- ✅ Queue management and job processing

## Mocking Strategy

All external dependencies are properly mocked to ensure:

- **Isolation**: Tests don't affect real external services
- **Reliability**: Tests are not dependent on external service availability
- **Speed**: Tests run quickly without network calls
- **Predictability**: Consistent test results regardless of external state

### Mocked Services

- **GitLab API**: All GitLab API calls are mocked
- **Notion API**: Notion client and API responses are mocked
- **LLM APIs**: OpenRouter and Ollama API calls are mocked
- **Database**: PostgreSQL connections and queries are mocked
- **File System**: File operations are mocked where needed
- **HTTP Requests**: Axios and other HTTP libraries are mocked

## Test Data and Fixtures

The test suite includes comprehensive test data:

- **GitLab Webhook Events**: Sample webhook payloads for different event types
- **Merge Request Data**: Mock merge request objects with various states
- **Code Files**: Sample code files for embedding tests
- **Notion Pages**: Mock Notion page responses
- **Database Records**: Sample database records for various entities

## Error Scenarios

Tests cover various error conditions:

- **Network Failures**: Timeout, connection errors, DNS failures
- **API Errors**: 4xx and 5xx HTTP responses, malformed responses
- **Database Errors**: Connection failures, query errors, constraint violations
- **Authentication Errors**: Invalid tokens, expired credentials
- **Rate Limiting**: API rate limit responses
- **Malformed Data**: Invalid webhook payloads, corrupted files

## Environment Configuration

Test environment variables are configured in `bunfig.toml`:

```toml
[test]
coverage = true

# Environment variables are set automatically by Bun during testing
```

## Best Practices

### Writing Tests

1. **Descriptive Names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Follow the AAA pattern
3. **Single Responsibility**: Each test should test one specific behavior
4. **Isolation**: Tests should not depend on each other
5. **Mocking**: Mock all external dependencies

### Test Organization

1. **Group Related Tests**: Use `describe` blocks to group related tests
2. **Setup and Teardown**: Use `beforeEach` and `afterEach` for test setup
3. **Clear Assertions**: Use specific assertions that clearly indicate what's being tested
4. **Error Testing**: Always test both success and failure scenarios

## Continuous Integration

The test suite is designed to run in CI/CD environments:

- **No External Dependencies**: All external services are mocked
- **Deterministic**: Tests produce consistent results
- **Fast Execution**: Tests complete quickly
- **Coverage Reports**: Generate coverage reports for analysis

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure all imports use `.js` extensions for ES modules
2. **Mock Issues**: Verify mocks are properly configured before test execution
3. **Async Issues**: Use proper async/await patterns for asynchronous tests
4. **Environment Variables**: Ensure test environment variables are set correctly

### Debug Mode

To debug tests:

```bash
# Run tests with verbose output
bun test --verbose

# Run a single test file
bun test src/test/unit/services/llm.test.ts

# Run tests with debugging
bun test --inspect
```

## Contributing

When adding new functionality:

1. **Write Tests First**: Follow TDD principles where possible
2. **Maintain Coverage**: Ensure new code is properly tested
3. **Update Documentation**: Update this document for significant changes
4. **Mock External Dependencies**: Always mock external services
5. **Test Edge Cases**: Include tests for error conditions and edge cases

## Performance

The test suite is optimized for performance:

- **Parallel Execution**: Tests run in parallel where possible
- **Efficient Mocking**: Lightweight mocks that don't slow down tests
- **Minimal Setup**: Fast test setup and teardown
- **Focused Tests**: Tests focus on specific functionality without unnecessary overhead

Target test execution time: < 30 seconds for the full suite.
