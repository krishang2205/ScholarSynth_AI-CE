import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Skeleton
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { SearchResult } from '../../types';

const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback((searchQuery: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch(searchQuery);
      }
    }, 500); // 500ms delay

    setSearchTimeout(timeout);
  }, []);

  // Handle query changes with debouncing
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    setError(null);
    
    if (newQuery.trim()) {
      debouncedSearch(newQuery);
    } else {
      setResults([]);
      setLoading(false);
    }
  };

  const handleSearch = async (searchQuery?: string) => {
    const queryToSearch = searchQuery || query.trim();
    if (!queryToSearch) return;

    console.log('Starting optimized search with query:', queryToSearch);
    setLoading(true);
    setError(null);
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout - please try again')), 15000); // 15 second timeout
    });
    
    try {
      const searchPromise = chrome.runtime.sendMessage({
        type: 'SEARCH_NOTES',
        data: { query: queryToSearch, limit: 10 }
      });

      const response = await Promise.race([searchPromise, timeoutPromise]);

      console.log('Search response:', response);

      if (response.error) {
        console.error('Search error:', response.error);
        setError(response.error);
        setResults([]);
      } else if (response.results) {
        console.log('Found', response.results.length, 'search results');
        setResults(response.results);
      } else {
        console.log('No results found or invalid response structure');
        setResults([]);
      }
    } catch (error) {
      console.error('Error searching notes:', error);
      setError(error instanceof Error ? error.message : 'Failed to search notes. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      handleSearch();
    }
  };

  const openNote = (note: any) => {
    if (note.url) {
      chrome.tabs.create({ url: note.url });
    }
  };

  const formatSimilarity = (similarity: number) => {
    return `${Math.round(similarity * 100)}%`;
  };

  const getSimilarityColor = (similarity: number) => {
    if (similarity > 0.8) return 'success';
    if (similarity > 0.6) return 'warning';
    return 'default';
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <Box>
      {[1, 2, 3].map((index) => (
        <Card key={index} sx={{ mb: 2 }}>
          <CardContent>
            <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="40%" height={20} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="80%" height={16} />
            <Skeleton variant="text" width="60%" height={16} />
          </CardContent>
        </Card>
      ))}
    </Box>
  );

  return (
    <Box sx={{ pb: 7 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Semantic Search
      </Typography>

      {/* Search Input */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search your notes semantically... (auto-search after typing)"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                ),
                endAdornment: loading && (
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                ),
              }}
            />
            <Button
              variant="contained"
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              sx={{ minWidth: 100 }}
            >
              Search
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Search through your notes using natural language. Results appear automatically as you type.
          </Typography>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && <LoadingSkeleton />}

      {/* Results */}
      {!loading && results.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Results ({results.length})
          </Typography>
          
          <List sx={{ p: 0 }}>
            {results.map((result, index) => (
              <Card key={result.note.id} sx={{ mb: 2 }}>
                <CardContent sx={{ p: 0 }}>
                  <Accordion
                    expanded={expandedNote === result.note.id}
                    onChange={() => setExpandedNote(
                      expandedNote === result.note.id ? null : result.note.id
                    )}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ mb: 0.5 }}>
                            {result.note.title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={formatSimilarity(result.similarity)}
                              size="small"
                              color={getSimilarityColor(result.similarity) as any}
                              variant="outlined"
                            />
                            <Typography variant="caption" color="text.secondary">
                              {format(new Date(result.note.createdAt), 'MMM d, yyyy')}
                            </Typography>
                          </Box>
                        </Box>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openNote(result.note);
                          }}
                          disabled={!result.note.url}
                        >
                          <OpenInNewIcon sx={{ fontSize: 16 }} />
                        </Button>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          <strong>Summary:</strong> {result.note.summary}
                        </Typography>
                        
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          <strong>Content:</strong> {result.note.content.length > 200 
                            ? `${result.note.content.substring(0, 200)}...` 
                            : result.note.content
                          }
                        </Typography>

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                          {result.note.tags.map((tag, tagIndex) => (
                            <Chip
                              key={tagIndex}
                              label={tag}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '10px', height: 20 }}
                            />
                          ))}
                        </Box>

                        {result.note.source && (
                          <Typography variant="caption" color="text.secondary">
                            Source: {result.note.source}
                          </Typography>
                        )}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </List>
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Box className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <Typography className="empty-state-title" color="error">
            Search Error
          </Typography>
          <Typography className="empty-state-description" color="error">
            {error}
          </Typography>
        </Box>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && query && !error && (
        <Box className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <Typography className="empty-state-title">
            No results found
          </Typography>
          <Typography className="empty-state-description">
            Try different keywords or phrases to search your notes
          </Typography>
        </Box>
      )}

      {/* Initial State */}
      {!loading && results.length === 0 && !query && !error && (
        <Box className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <Typography className="empty-state-title">
            Search Your Notes
          </Typography>
          <Typography className="empty-state-description">
            Start typing to search through your notes. The AI will understand the context and find the most relevant matches.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Search; 