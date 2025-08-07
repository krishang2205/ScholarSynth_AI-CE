import React, { useState, useEffect } from 'react';
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
  AccordionDetails
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
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    console.log('Starting search with query:', query.trim());
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_NOTES',
        data: { query: query.trim(), limit: 10 }
      });

      console.log('Search response:', response);

      if (response.results) {
        console.log('Found', response.results.length, 'search results');
        setResults(response.results);
      } else {
        console.log('No results found or invalid response structure');
        setResults([]);
      }
    } catch (error) {
      console.error('Error searching notes:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
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
              placeholder="Search your notes semantically..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                ),
              }}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              sx={{ minWidth: 100 }}
            >
              {loading ? <CircularProgress size={20} /> : 'Search'}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Search through your notes using natural language. The AI will find the most relevant content.
          </Typography>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
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

      {/* Empty State */}
      {!loading && results.length === 0 && query && (
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
      {!loading && results.length === 0 && !query && (
        <Box className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <Typography className="empty-state-title">
            Search Your Notes
          </Typography>
          <Typography className="empty-state-description">
            Use natural language to find relevant content in your saved notes. 
            The AI will understand the context and find the most relevant matches.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Search; 