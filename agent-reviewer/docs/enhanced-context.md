# Enhanced Context Gathering for Small Changesets

## Overview

The Enhanced Context Gathering feature intelligently provides additional repository context when processing small merge requests. This enables more thorough and insightful code reviews by gathering context beyond just the changed files.

## How It Works

### Automatic Detection

The system automatically detects "small changesets" based on configurable thresholds:
- **File count**: Default ≤ 5 files changed
- **Line count**: Default ≤ 50 lines modified (additions + deletions)

### Enhanced Context Types

For small changesets, the system gathers additional context including:

1. **Inheritance Context**
   - Parent classes, interfaces, or modules that changed code extends/implements
   - Child classes that inherit from modified classes
   - Interface implementations

2. **Dependency Context**
   - Functions or methods that call modified functions
   - Files that import from modified modules
   - Related dependencies and usage patterns

3. **Test Context**
   - Test files that test modified classes or functions
   - Related test suites and specifications

4. **Configuration Context**
   - Configuration files that reference modified files
   - Constants and settings that might be affected

5. **Documentation Context**
   - Documentation files that mention modified components
   - README files and guides that might need updates

### Integration with Existing Workflow

Enhanced context gathering:
- ✅ **Non-breaking**: Existing functionality remains unchanged
- ✅ **Optional**: Can be enabled/disabled via environment variables
- ✅ **Performance-conscious**: Only runs for small changesets
- ✅ **Graceful degradation**: Falls back to standard context if enhanced context fails
- ✅ **Seamless integration**: Works with existing Notion task context and project context

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# Enhanced Context Configuration
ENHANCED_CONTEXT_ENABLED='true'                    # Enable/disable the feature
ENHANCED_CONTEXT_MAX_LINES=50                      # Max lines for small changeset
ENHANCED_CONTEXT_MAX_FILES=5                       # Max files for small changeset
ENHANCED_CONTEXT_MAX_QUERIES=10                    # Max context queries to execute
ENHANCED_CONTEXT_TIMEOUT_MS=30000                  # Timeout for context gathering
ENHANCED_CONTEXT_MAX_RESULTS_PER_QUERY=5          # Max results per query
```

### Default Values

| Setting | Default | Description |
|---------|---------|-------------|
| `ENHANCED_CONTEXT_ENABLED` | `true` | Enable enhanced context gathering |
| `ENHANCED_CONTEXT_MAX_LINES` | `50` | Maximum lines changed to qualify as small changeset |
| `ENHANCED_CONTEXT_MAX_FILES` | `5` | Maximum files changed to qualify as small changeset |
| `ENHANCED_CONTEXT_MAX_QUERIES` | `10` | Maximum number of context queries to execute |
| `ENHANCED_CONTEXT_TIMEOUT_MS` | `30000` | Timeout for enhanced context gathering (30 seconds) |
| `ENHANCED_CONTEXT_MAX_RESULTS_PER_QUERY` | `5` | Maximum results returned per context query |

## Code Review Enhancement

### Enhanced Prompts

When enhanced context is available, the AI reviewer receives:

1. **Changeset Analysis**: Statistics about the small changeset
2. **Context Queries**: Results from intelligent context gathering
3. **Enhanced Instructions**: Specific guidance to use the additional context

### Review Quality Improvements

Enhanced context enables the AI to:
- **Catch breaking changes**: Identify impacts on dependent code
- **Suggest related updates**: Recommend updates to tests, docs, or config
- **Validate architecture**: Ensure changes align with existing patterns
- **Identify missing pieces**: Spot missing test coverage or documentation updates

## Technical Implementation

### Architecture

```
MergeRequest → ContextService → EnhancedContextService → CodebaseRetrieval
                     ↓
              ProjectContext (with enhanced context)
                     ↓
              ReviewService → AI Review with Enhanced Context
```

### Key Components

1. **EnhancedContextService**: Main service for enhanced context gathering
2. **ChangesetAnalyzer**: Analyzes changeset size and complexity
3. **CodeElementExtractor**: Extracts classes, functions, imports from changed files
4. **ContextQueryGenerator**: Generates intelligent queries for codebase-retrieval
5. **ContextAggregator**: Combines and formats enhanced context results

### Supported Languages

The system can extract code elements from:
- **JavaScript/TypeScript**: Classes, functions, interfaces, imports/exports
- **Python**: Classes, functions, imports
- **Java**: Classes, interfaces, methods, imports
- **Vue**: Components, script sections
- **Generic**: Function-like patterns for other languages

## Monitoring and Debugging

### Logging

Enhanced context gathering provides detailed logging:

```
Getting enhanced context for small changeset in project 123
Changeset stats: {totalFiles: 2, totalLinesModified: 15, isSmallChangeset: true}
Extracted 5 code elements
Generated 8 context queries
Executed 8 queries
Enhanced context gathering completed: success
```

### Performance Metrics

The system tracks:
- Execution time for context gathering
- Success/failure rates of context queries
- Number of enhanced files discovered
- Query performance by category

## Future Enhancements

### Planned Improvements

1. **Codebase-Retrieval Integration**: Full integration with the codebase-retrieval tool
2. **Smart Query Optimization**: Machine learning to improve query generation
3. **Context Caching**: Cache context results for better performance
4. **Language-Specific Extractors**: More sophisticated code analysis per language
5. **Custom Query Templates**: User-defined context query patterns

### Extensibility

The system is designed to be easily extensible:
- Add new code element extractors for additional languages
- Create custom context query generators
- Implement new context aggregation strategies
- Add support for framework-specific patterns

## Troubleshooting

### Common Issues

1. **Enhanced context not triggering**
   - Check if changeset exceeds size thresholds
   - Verify `ENHANCED_CONTEXT_ENABLED=true`
   - Check logs for error messages

2. **Slow performance**
   - Reduce `ENHANCED_CONTEXT_MAX_QUERIES`
   - Lower `ENHANCED_CONTEXT_TIMEOUT_MS`
   - Check codebase-retrieval tool performance

3. **Poor context quality**
   - Review generated queries in logs
   - Adjust query generation logic
   - Verify code element extraction accuracy

### Debug Mode

Enable detailed logging by setting log level to debug in your application.

## Contributing

To contribute to enhanced context gathering:

1. **Add Language Support**: Implement new code element extractors
2. **Improve Query Generation**: Enhance context query logic
3. **Add Context Types**: Create new categories of context gathering
4. **Performance Optimization**: Improve execution speed and efficiency

See the main project README for contribution guidelines.
